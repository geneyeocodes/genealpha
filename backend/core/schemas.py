from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from backend.strategies.config_schema import StrategyConfig


class BotCreate(BaseModel):
    name: str
    symbol: str
    account_mode: str = "paper"
    order_type: str = "market"
    max_position_size: float = 5000.0
    max_daily_loss: float = 200.0
    strategy_name: str
    strategy_params: dict = {}
    schedule_cron: str = "0 9 * * 1-5"


class BotUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    account_mode: Optional[str] = None
    order_type: Optional[str] = None
    max_position_size: Optional[float] = None
    max_daily_loss: Optional[float] = None
    strategy_params: Optional[dict] = None
    schedule_cron: Optional[str] = None


class BotResponse(BaseModel):
    id: str
    name: str
    symbol: str
    status: str
    account_mode: str
    order_type: str
    max_position_size: float
    max_daily_loss: float
    strategy_name: str
    strategy_params: dict
    schedule_cron: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TradeResponse(BaseModel):
    id: str
    bot_id: str
    symbol: str
    side: str
    quantity: float
    price: float
    pnl: Optional[float]
    timestamp: datetime

    model_config = {"from_attributes": True}


class BacktestRequest(BaseModel):
    bot_id: str
    start_date: str
    end_date: str


class BacktestResponse(BaseModel):
    id: str
    bot_id: str
    total_return: Optional[float]
    sharpe_ratio: Optional[float]
    max_drawdown: Optional[float]
    win_rate: Optional[float]
    total_trades: Optional[int]
    avg_hold_days: Optional[float]
    profit_factor: Optional[float]
    equity_curve: Optional[Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class OptimizationRequest(BaseModel):
    bot_id: str
    total_trials: int = 240


class OptimizationResponse(BaseModel):
    id: str
    bot_id: str
    total_trials: Optional[int]
    best_params: Optional[dict]
    best_sharpe: Optional[float]
    best_return: Optional[float]
    best_drawdown: Optional[float]
    results: Optional[Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class ExtractRequest(BaseModel):
    text: str
    source_type: str = "text"


class ExtractResponse(BaseModel):
    strategy: StrategyConfig
    source_type: str = "text"
    raw_excerpt: Optional[str] = None  # first 200 chars of the source, for frontend display
