"""
Optimization — delegates to scripts/optimize endpoint.
Kept for backward compatibility.
"""

import optuna
import vectorbt as vbt
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..scripts.base import get_script, list_scripts
from ..core.datafeed import fetch_historical_data

router = APIRouter()


class OptimizationRunRequest(BaseModel):
    script_name: str
    symbol: str = "SPY"
    total_trials: int = 100
    initial_capital: float = 10000.0


class OptimizationRunResponse(BaseModel):
    best_params: dict
    best_composite_score: float
    best_total_pnl: float
    best_max_drawdown: float
    best_profitable_trades: int
    best_profit_factor: Optional[float] = None
    top_results: list


@router.post("/", response_model=OptimizationRunResponse)
async def run_optimization_endpoint(data: OptimizationRunRequest):
    """Run hyperparameter optimization on a strategy script."""
    spec = get_script(data.script_name)
    if not spec:
        raise HTTPException(
            status_code=404,
            detail=f"Script '{data.script_name}' not found. Available: {[s['name'] for s in list_scripts()]}",
        )

    df = fetch_historical_data(data.symbol, "2020-01-01", "2024-12-31")
    if df is None or df.empty:
        raise HTTPException(status_code=400, detail=f"No data for {data.symbol}")

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
                init_cash=data.initial_capital,
                size=0.95,
                size_type="percent",
                freq="d",
            )

            # Compute all metrics manually from equity curve
            equity_curve = portfolio.value()
            daily_returns = equity_curve.pct_change().dropna()
            total_pnl = float((equity_curve.iloc[-1] / data.initial_capital - 1) * 100)
            peak = equity_curve.cummax()
            dd = ((equity_curve - peak) / peak) * 100
            max_dd = float(dd.min())
            sharpe = (
                float(daily_returns.mean() / daily_returns.std() * (252**0.5))
                if len(daily_returns) > 0 and daily_returns.std() > 0
                else 0.0
            )

            # Get trade records safely across vectorbt versions
            trades_obj = portfolio.trades() if callable(portfolio.trades) else portfolio.trades
            _rd = getattr(trades_obj, "records_readable", None)
            trades_df = _rd if _rd is not None else pd.DataFrame(getattr(trades_obj, "records", []))

            total_trades = len(trades_df)
            win_rate = (len(trades_df[trades_df["PnL"] > 0]) / max(len(trades_df), 1)) * 100

            # Derive profitable trades
            profitable = round(total_trades * win_rate / 100) if win_rate > 0 else 0

            score = (
                0.40 * (max(0, min(sharpe / 5.0, 1.0)))
                + 0.25 * (max(0, min(total_pnl / 200.0, 1.0)))
                - 0.20 * (max(0, min(max_dd / 50.0, 1.0)))
                + 0.15 * (win_rate / 100.0)
            )

            profitable = len(trades_df[trades_df["PnL"] > 0])
            gross_profit = trades_df[trades_df["PnL"] > 0]["PnL"].sum() if profitable > 0 else 0
            gross_loss = abs(trades_df[trades_df["PnL"] < 0]["PnL"].sum()) if (len(trades_df) - profitable) > 0 else 0
            pf = gross_profit / gross_loss if gross_loss > 0 else (float("inf") if gross_profit > 0 else None)

            results.append(
                {
                    "params": dict(params),
                    "composite_score": round(score, 4),
                    "total_pnl": round(total_pnl, 2),
                    "max_drawdown": round(float(max_dd), 2),
                    "sharpe_ratio": round(float(sharpe), 2),
                    "win_rate": round(win_rate, 2),
                    "total_trades": len(trades_df),
                    "profitable_trades": profitable,
                    "profit_factor": round(pf, 2) if pf is not None and pf != float("inf") else None,
                }
            )
            return score
        except Exception:
            return -999.0

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler())
    study.optimize(objective, n_trials=data.total_trials, show_progress_bar=False)

    results.sort(key=lambda r: r.get("composite_score", 0), reverse=True)

    best = results[0] if results else {}
    return OptimizationRunResponse(
        best_params=best.get("params", {}),
        best_composite_score=best.get("composite_score", 0),
        best_total_pnl=best.get("total_pnl", 0),
        best_max_drawdown=best.get("max_drawdown", 0),
        best_profitable_trades=best.get("profitable_trades", 0),
        best_profit_factor=best.get("profit_factor"),
        top_results=results[:20],
    )
