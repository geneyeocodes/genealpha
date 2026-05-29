"""
Backtest API — delegates to script-based backtesting.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from ..core.database import get_db
from ..core.models import BacktestResult
from ..core.schemas import BacktestResponse

router = APIRouter()


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
