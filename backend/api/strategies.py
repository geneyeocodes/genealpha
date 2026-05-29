"""
Strategy execution endpoints — now uses ScriptRunner instead of StrategyEngine.
Kept for backward compatibility; delegates to scripts/runner.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..scripts.runner import run_backtest

router = APIRouter()


class BacktestRunRequest(BaseModel):
    script_name: str
    params: dict = {}
    symbol: str = "SPY"
    start_date: str = "2020-01-01"
    end_date: str = "2024-12-31"
    initial_capital: float = 10000.0


class BacktestRunResponse(BaseModel):
    total_pnl: float
    max_drawdown: float
    profitable_trades: int
    total_trades: int
    profit_factor: Optional[float] = None
    sharpe_ratio: float = 0
    final_capital: float = 0
    equity_curve: list = []
    trades: list = []


@router.post("/backtest", response_model=BacktestRunResponse)
async def run_backtest_endpoint(req: BacktestRunRequest):
    """Run a backtest for a strategy script."""
    try:
        result = run_backtest(
            script_name=req.script_name,
            params=req.params,
            symbol=req.symbol,
            start_date=req.start_date,
            end_date=req.end_date,
            initial_capital=req.initial_capital,
        )
        return BacktestRunResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")


@router.get("/scripts")
async def list_strategy_scripts():
    """List all available strategy scripts."""
    from ..scripts.base import list_scripts

    return {"scripts": list_scripts()}


@router.get("/indicators")
async def list_indicators():
    """Deprecated — strategies now use script-defined logic."""
    return {
        "indicators": [],
        "message": "Strategies now use Python scripts, not config-driven indicators. See /scripts endpoint.",
    }
