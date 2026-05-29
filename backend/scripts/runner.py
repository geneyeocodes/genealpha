"""
Script runner — loads a strategy spec, fetches data, backtests with vectorbt,
and returns consolidated metrics: total_pnl, max_drawdown, profitable_trades, profit_factor.
"""

from typing import Optional, Dict, Any
import pandas as pd
import numpy as np
import vectorbt as vbt

from ..core.datafeed import fetch_historical_data
from .base import get_script, list_scripts


def run_backtest(
    script_name: str,
    params: Dict[str, Any],
    symbol: str = "SPY",
    start_date: str = "2020-01-01",
    end_date: str = "2024-12-31",
    initial_capital: float = 10000.0,
    size_pct: float = 0.95,
) -> dict:
    spec = get_script(script_name)
    if spec is None:
        raise ValueError(f"Strategy script '{script_name}' not found. Available: {list_scripts()}")

    df = fetch_historical_data(symbol, start_date, end_date, interval="1d")
    if df is None or df.empty:
        raise ValueError(f"No historical data for {symbol} from {start_date} to {end_date}")

    result = spec.run_func(df, params)
    entries = result.get("entries")
    exits = result.get("exits")
    if entries is None or exits is None:
        raise ValueError("Script must return 'entries' and 'exits' as pd.Series or array-like")

    portfolio = vbt.Portfolio.from_signals(
        df["close"],
        entries=entries,
        exits=exits,
        init_cash=initial_capital,
        size=size_pct,
        size_type="percent",
        freq="d",
    )

    # --- Metrics from equity curve (guaranteed to work on all vectorbt versions) ---
    equity = portfolio.value()
    total_pnl_pct = float((equity.iloc[-1] / initial_capital - 1) * 100)
    peak_equity = equity.cummax()
    max_dd = float(((equity - peak_equity) / peak_equity).min() * 100)
    daily_ret = equity.pct_change().dropna()
    sharpe_val = (
        float(daily_ret.mean() / daily_ret.std() * (252**0.5)) if len(daily_ret) > 0 and daily_ret.std() > 0 else 0.0
    )
    final_cap = float(equity.iloc[-1])
    equity_list = equity.tolist()

    # --- Trades via getattr (Pylance-safe, cross-version compatible) ---
    trades_obj = portfolio.trades() if callable(portfolio.trades) else portfolio.trades
    records = getattr(trades_obj, "records_readable", None)
    if records is not None:
        trades_df = records
    else:
        raw_records = getattr(trades_obj, "records", None)
        trades_df = pd.DataFrame(raw_records) if raw_records is not None else pd.DataFrame()

    total_trades = len(trades_df)
    wins = len(trades_df[trades_df["PnL"] > 0]) if total_trades > 0 else 0
    profitable_trades = wins

    gross_profit = trades_df[trades_df["PnL"] > 0]["PnL"].sum() if wins > 0 else 0
    gross_loss = abs(trades_df[trades_df["PnL"] < 0]["PnL"].sum()) if (total_trades - wins) > 0 else 0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (float("inf") if gross_profit > 0 else None)

    # --- Build trade log ---
    trade_log = []
    for _, row in trades_df.iterrows():
        trade_log.append(
            {
                "entry_price": float(row.get("Entry Price", row.get("entry_price", 0))),
                "exit_price": float(row.get("Exit Price", row.get("exit_price", 0))),
                "pnl": float(row.get("PnL", row.get("pnl", 0))),
                "return_pct": float(row.get("Return", row.get("return", 0))),
            }
        )

    return {
        "total_pnl": round(total_pnl_pct, 2),
        "max_drawdown": round(max_dd, 2),
        "profitable_trades": profitable_trades,
        "total_trades": total_trades,
        "profit_factor": (
            round(profit_factor, 2) if profit_factor is not None and profit_factor != float("inf") else None
        ),
        "sharpe_ratio": round(sharpe_val, 2),
        "final_capital": round(final_cap, 2),
        "equity_curve": equity_list,
        "trades": trade_log[:50],
    }
