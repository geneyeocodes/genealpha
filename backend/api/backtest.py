from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from ..core.database import get_db
from ..core.models import BacktestResult
from ..core.schemas import BacktestResponse
from ..core.datafeed import fetch_historical_data
from ..strategies import StrategyConfig, StrategyEngine

router = APIRouter()


class BacktestRunRequest(BaseModel):
    config: dict
    symbol: str
    start_date: str
    end_date: str
    initial_capital: float = 10000.0


class BacktestRunResponse(BaseModel):
    total_return_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    win_rate_pct: float
    total_trades: int
    avg_hold_periods: float
    profit_factor: float | None
    final_capital: float
    equity_curve: list
    trades: list


@router.get("/", response_model=list[BacktestResponse])
async def list_backtests(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BacktestResult).order_by(BacktestResult.created_at.desc()))
    return result.scalars().all()


@router.get("/{backtest_id}", response_model=BacktestResponse)
async def get_backtest(backtest_id: str, db: AsyncSession = Depends(get_db)):
    bt = await db.get(BacktestResult, backtest_id)
    if not bt:
        raise HTTPException(status_code=404, detail="Backtest not found")
    return bt


@router.post("/", response_model=BacktestRunResponse)
async def run_backtest(data: BacktestRunRequest):
    """Run a backtest from a raw strategy config and symbol."""
    try:
        config = StrategyConfig(**data.config)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid strategy config: {e}")

    df = fetch_historical_data(data.symbol, data.start_date, data.end_date)
    if df is None or df.empty:
        raise HTTPException(status_code=400, detail=f"No historical data for {data.symbol}")

    engine = StrategyEngine(config)
    result = engine.backtest(df, data.initial_capital)
    return result
