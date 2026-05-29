from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class BotCreate(BaseModel):
    name: str
    symbol: str
    account_mode: str = "paper"
    order_type: str = "market"
    max_position_size: float = 5000.0
    max_daily_loss: float = 200.0
    script_name: str = "sma_crossover"
    script_params: dict = {}
    schedule_cron: str = "0 9 * * 1-5"


class BotUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    account_mode: Optional[str] = None
    order_type: Optional[str] = None
    max_position_size: Optional[float] = None
    max_daily_loss: Optional[float] = None
    script_name: Optional[str] = None
    script_params: Optional[dict] = None
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
    script_name: str
    script_params: dict
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
    total_pnl: Optional[float]
    max_drawdown: Optional[float]
    profitable_trades: Optional[int]
    total_trades: Optional[int]
    profit_factor: Optional[float]
    sharpe_ratio: Optional[float]
    equity_curve: Optional[Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class OptimizationRequest(BaseModel):
    bot_id: str
    total_trials: int = 100


class OptimizationResponse(BaseModel):
    id: str
    bot_id: str
    total_trials: Optional[int]
    best_params: Optional[dict]
    best_total_pnl: Optional[float]
    best_max_drawdown: Optional[float]
    best_profitable_trades: Optional[int]
    best_profit_factor: Optional[float]
    results: Optional[Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class ExtractRequest(BaseModel):
    text: str


class ExtractResponse(BaseModel):
    script_name: str
    param_count: int
    params: dict
    source_code: str
