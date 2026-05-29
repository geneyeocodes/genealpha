"""
Optimization runner.
Takes a strategy script name, reads its @strategy_spec params,
and uses Optuna to find the best parameter combination via vectorbt backtests.
"""

from typing import Optional
import optuna
import pandas as pd
import numpy as np
import vectorbt as vbt

from ..scripts.base import get_script, list_scripts
from ..core.datafeed import fetch_historical_data


def run_optimization(
    script_name: str,
    symbol: str = "SPY",
    n_trials: int = 100,
    initial_capital: float = 10000.0,
    start_date: str = "2020-01-01",
    end_date: str = "2024-12-31",
    size_pct: float = 0.95,
) -> tuple[dict, float, list]:
    """
    Run hyperparameter optimization on a strategy script.

    Args:
        script_name: Name of the registered strategy script.
        symbol: Ticker symbol for backtest data.
        n_trials: Number of Optuna trials.
        initial_capital: Starting capital for backtests.
        start_date, end_date: Date range.
        size_pct: Fraction of capital per trade.

    Returns:
        (best_params, best_composite_score, sorted_results_list)
    """
    spec = get_script(script_name)
    if spec is None:
        raise ValueError(f"Strategy script '{script_name}' not found. Available: {[s['name'] for s in list_scripts()]}")

    df = fetch_historical_data(symbol, start_date, end_date, interval="1d")
    if df is None or df.empty:
        raise ValueError(f"No historical data for {symbol}")

    results = []

    def objective(trial):
        params = {}
        for pname, pspec in spec.params.items():
            ptype = pspec.get("type", "int")
            pmin = pspec.get("min", 0)
            pmax = pspec.get("max", 100)
            if ptype == "int":
                params[pname] = trial.suggest_int(pname, int(pmin), int(pmax))
            else:
                params[pname] = trial.suggest_float(pname, float(pmin), float(pmax))

        try:
            sig_result = spec.run_func(df, params)
            entries = sig_result.get("entries")
            exits = sig_result.get("exits")
            if entries is None or exits is None:
                return -999.0

            portfolio = vbt.Portfolio.from_signals(
                df["close"],
                entries=entries,
                exits=exits,
                init_cash=initial_capital,
                size=size_pct,
                size_type="percent",
                freq="d",
            )

            # Metrics from equity curve (cross-version compatible)
            equity = portfolio.value()
            total_pnl = float((equity.iloc[-1] / initial_capital - 1) * 100)
            peak_equity = equity.cummax()
            max_dd = float(((equity - peak_equity) / peak_equity).min() * 100)
            daily_ret = equity.pct_change().dropna()
            sharpe = (
                float(daily_ret.mean() / daily_ret.std() * (252**0.5))
                if len(daily_ret) > 0 and daily_ret.std() > 0
                else 0.0
            )

            # Trades
            trades_obj = portfolio.trades() if callable(portfolio.trades) else portfolio.trades
            records = getattr(trades_obj, "records_readable", None)
            if records is not None:
                trades_df = records
            else:
                raw_records = getattr(trades_obj, "records", None)
                trades_df = pd.DataFrame(raw_records) if raw_records is not None else pd.DataFrame()

            total_trades = len(trades_df)
            wins = len(trades_df[trades_df["PnL"] > 0]) if total_trades > 0 else 0
            win_rate = (wins / total_trades * 100) if total_trades > 0 else 0

            gross_profit = trades_df[trades_df["PnL"] > 0]["PnL"].sum() if wins > 0 else 0
            gross_loss = abs(trades_df[trades_df["PnL"] < 0]["PnL"].sum()) if (total_trades - wins) > 0 else 0
            pf = gross_profit / gross_loss if gross_loss > 0 else (float("inf") if gross_profit > 0 else None)

            # Composite score: 40% Sharpe + 25% Return - 20% DD + 15% Win Rate
            score = (
                0.40 * (max(0, min(sharpe / 5.0, 1.0)))
                + 0.25 * (max(0, min(total_pnl / 200.0, 1.0)))
                - 0.20 * (max(0, min(max_dd / 50.0, 1.0)))
                + 0.15 * (win_rate / 100.0)
            )

            results.append(
                {
                    "params": dict(params),
                    "composite_score": round(score, 4),
                    "total_pnl": round(total_pnl, 2),
                    "max_drawdown": round(float(max_dd), 2),
                    "sharpe_ratio": round(float(sharpe), 2),
                    "win_rate": round(win_rate, 2),
                    "total_trades": total_trades,
                    "profitable_trades": wins,
                    "profit_factor": round(pf, 2) if pf is not None and pf != float("inf") else None,
                }
            )
            return score
        except Exception:
            return -999.0

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler())
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    results.sort(key=lambda r: r.get("composite_score", 0), reverse=True)
    return study.best_params, study.best_value, results
