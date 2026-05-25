from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..strategies import StrategyConfig, StrategyEngine

router = APIRouter()


class BacktestRequest(BaseModel):
    config: dict
    initial_capital: float = 10000.0


class BacktestResponse(BaseModel):
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


@router.post("/backtest")
async def run_backtest(req: BacktestRequest):
    """Run a backtest for a strategy config against historical data."""
    try:
        config = StrategyConfig(**req.config)
        engine = StrategyEngine(config)

        # Fetch historical data (placeholder — real impl would pull from datafeed)
        import pandas as pd
        import yfinance as yf

        symbol = req.config.get("symbol", "SPY")
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="5y")
        if hist.empty:
            raise HTTPException(status_code=400, detail=f"No historical data for {symbol}")

        hist.columns = [c.lower() for c in hist.columns]
        result = engine.backtest(hist, req.initial_capital)
        return result

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
