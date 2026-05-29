"""
API endpoints for managing and running strategy scripts.
"""

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any, Dict
from ..scripts.base import registry as get_registry, get_script, list_scripts
from ..scripts.runner import run_backtest

router = APIRouter()


class ScriptInfoResponse(BaseModel):
    name: str
    description: str
    params: dict
    param_count: int


class ScriptRunRequest(BaseModel):
    script_name: str
    params: dict = {}
    symbol: str = "SPY"
    start_date: str = "2020-01-01"
    end_date: str = "2024-12-31"
    initial_capital: float = 10000.0


class ScriptRunResponse(BaseModel):
    total_pnl: float
    max_drawdown: float
    profitable_trades: int
    total_trades: int
    profit_factor: Optional[float] = None
    sharpe_ratio: float = 0
    final_capital: float = 0
    equity_curve: list = []
    trades: list = []


class ScriptOptimizeRequest(BaseModel):
    script_name: str
    symbol: str = "SPY"
    total_trials: int = 100
    initial_capital: float = 10000.0


class ScriptOptimizeResponse(BaseModel):
    best_params: dict
    best_total_pnl: float
    best_max_drawdown: float
    best_profitable_trades: int
    best_profit_factor: Optional[float] = None
    top_results: list


@router.get("/", response_model=list[ScriptInfoResponse])
async def list_all_scripts():
    """List all registered strategy scripts."""
    return list_scripts()


@router.get("/{script_name}", response_model=ScriptInfoResponse)
async def get_script_info(script_name: str):
    """Get details of a specific strategy script."""
    spec = get_script(script_name)
    if not spec:
        raise HTTPException(
            status_code=404,
            detail=f"Script '{script_name}' not found",
        )
    return ScriptInfoResponse(
        name=spec.name,
        description=spec.description,
        params=spec.params,
        param_count=len(spec.params),
    )


@router.post("/run", response_model=ScriptRunResponse)
async def run_strategy_script(data: ScriptRunRequest):
    """Run a strategy script backtest and return key metrics."""
    try:
        result = run_backtest(
            script_name=data.script_name,
            params=data.params,
            symbol=data.symbol,
            start_date=data.start_date,
            end_date=data.end_date,
            initial_capital=data.initial_capital,
        )
        return ScriptRunResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")


@router.post("/optimize", response_model=ScriptOptimizeResponse)
async def optimize_strategy_script(data: ScriptOptimizeRequest):
    """Run hyperparameter optimization on a strategy script."""
    import optuna
    from ..core.datafeed import fetch_historical_data

    spec = get_script(data.script_name)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Script '{data.script_name}' not found")

    # Fetch data once (all trials share the same data)
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

        # Run strategy
        try:
            sig_result = spec.run_func(df, params)
            entries = sig_result.get("entries")
            exits = sig_result.get("exits")
            if entries is None or exits is None:
                return -999.0

            import vectorbt as vbt

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

            _trades_obj = portfolio.trades() if callable(portfolio.trades) else portfolio.trades
            _trades_records = getattr(_trades_obj, "records_readable", None)
            trades_df = (
                _trades_records if _trades_records is not None else pd.DataFrame(getattr(_trades_obj, "records", []))
            )

            win_rate = (len(trades_df[trades_df["PnL"] > 0]) / max(len(trades_df), 1)) * 100

            # Composite: 40% Sharpe + 25% Return - 20% DD + 15% Win Rate
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
                    "total_trades": len(trades_df),
                    "profitable_trades": len(trades_df[trades_df["PnL"] > 0]),
                }
            )
            return score

        except Exception:
            return -999.0

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler())
    study.optimize(objective, n_trials=data.total_trials, show_progress_bar=False)

    results.sort(key=lambda r: r.get("composite_score", 0), reverse=True)

    best_result = results[0] if results else {}
    return ScriptOptimizeResponse(
        best_params=best_result.get("params", {}),
        best_total_pnl=best_result.get("total_pnl", 0),
        best_max_drawdown=best_result.get("max_drawdown", 0),
        best_profitable_trades=best_result.get("profitable_trades", 0),
        best_profit_factor=best_result.get("profit_factor"),
        top_results=results[:20],
    )
