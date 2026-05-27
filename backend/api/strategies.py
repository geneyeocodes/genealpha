from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..strategies import StrategyConfig, StrategyEngine
from ..core.datafeed import fetch_historical_data

router = APIRouter()


class BacktestRequest(BaseModel):
    config: dict
    symbol: str = "SPY"
    start_date: str = "2020-01-01"
    end_date: str = "2025-01-01"
    initial_capital: float = 10000.0


class BacktestResponse(BaseModel):
    """Field names match what the frontend BacktestResult type expects."""

    total_return: float
    sharpe_ratio: float
    max_drawdown: float
    win_rate: float
    total_trades: int
    avg_hold_days: float
    profit_factor: Optional[float] = None
    final_capital: float
    equity_curve: list[float]
    trades: list


@router.post("/backtest", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest):
    """Run a backtest for a strategy config against historical data."""
    try:
        # Validate config (extra keys like 'symbol' are ignored)
        config = StrategyConfig(**req.config)
        engine = StrategyEngine(config)

        # Fetch historical data
        df = fetch_historical_data(req.symbol, req.start_date, req.end_date)
        if df is None or df.empty:
            raise HTTPException(
                status_code=400,
                detail=f"No historical data for {req.symbol} " f"({req.start_date} to {req.end_date})",
            )

        result = engine.backtest(df, req.initial_capital)

        # Map engine result fields to frontend-expected field names
        # and flatten equity_curve to a list of numbers
        return BacktestResponse(
            total_return=result.get("total_return_pct", 0),
            sharpe_ratio=result.get("sharpe_ratio", 0),
            max_drawdown=result.get("max_drawdown_pct", 0),
            win_rate=result.get("win_rate_pct", 0),
            total_trades=result.get("total_trades", 0),
            avg_hold_days=result.get("avg_hold_periods", 0),
            profit_factor=result.get("profit_factor"),
            final_capital=result.get("final_capital", 0),
            equity_curve=[e["equity"] for e in (result.get("equity_curve") or [])],
            trades=result.get("trades", []),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/schema")
async def get_strategy_schema():
    """Return the JSON schema for strategy configuration."""
    return StrategyConfig.model_json_schema()


@router.get("/indicators")
async def list_indicators():
    """List all supported indicators."""
    return {
        "indicators": [
            {"name": "sma", "label": "Simple Moving Average", "params": ["period", "source"]},
            {"name": "ema", "label": "Exponential Moving Average", "params": ["period", "source"]},
            {"name": "rsi", "label": "Relative Strength Index", "params": ["period", "source"]},
            {"name": "macd", "label": "MACD Histogram", "params": ["period", "source"]},
            {"name": "bollinger", "label": "Bollinger Bands %B", "params": ["period", "source", "stddev"]},
            {"name": "atr", "label": "Average True Range", "params": ["period", "source"]},
            {"name": "stochastic", "label": "Stochastic %K", "params": ["period", "source"]},
            {"name": "obv", "label": "On-Balance Volume", "params": ["source"]},
            {"name": "volume", "label": "Volume", "params": []},
            {"name": "vwap", "label": "Volume-Weighted Avg Price", "params": []},
        ],
        "condition_types": ["crossover", "crossunder", "comparison", "range", "and", "or"],
        "position_sizing": ["risk_percent", "fixed_quantity", "percent_equity"],
        "stop_loss_methods": ["atr_multiple", "fixed_percent", "price_level"],
    }
