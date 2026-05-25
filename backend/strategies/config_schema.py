from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Union


class IndicatorParams(BaseModel):
    """Parameters for a technical indicator."""

    period: Optional[int] = 14
    source: Literal["close", "high", "low", "open", "volume", "hl2", "hlc3", "ohlc4"] = "close"
    stddev: Optional[float] = 2.0  # for Bollinger Bands


class IndicatorRef(BaseModel):
    """Reference to an indicator."""

    name: str  # sma, ema, rsi, macd, bollinger, atr, stochastic, obv, vwap, volume
    params: IndicatorParams = Field(default_factory=IndicatorParams)


class Condition(BaseModel):
    """A single entry or exit condition."""

    type: Literal["crossover", "crossunder", "comparison", "range", "and", "or"]
    # For crossover/crossunder
    indicator: Optional[IndicatorRef] = None
    crosses_above: Optional[IndicatorRef] = None  # for crossover
    crosses_below: Optional[IndicatorRef] = None  # for crossunder
    # For comparison
    source: Optional[Literal["price", "indicator"]] = "indicator"
    operator: Optional[Literal[">", "<", ">=", "<=", "==", "!="]] = None
    value: Optional[float] = None
    compare_to_indicator: Optional[IndicatorRef] = None
    # For range
    min: Optional[float] = None
    max: Optional[float] = None
    # For and/or (nested conditions)
    conditions: Optional[List["Condition"]] = None


Condition.model_rebuild()


class PositionSizing(BaseModel):
    method: Literal["risk_percent", "fixed_quantity", "percent_equity"] = "risk_percent"
    value: float = 2.0


class StopLoss(BaseModel):
    method: Literal["atr_multiple", "fixed_percent", "price_level"] = "atr_multiple"
    params: dict = Field(default_factory=lambda: {"multiplier": 1.5})


class TakeProfit(BaseModel):
    method: Literal["risk_reward_ratio", "fixed_percent", "price_level"] = "risk_reward_ratio"
    params: dict = Field(default_factory=lambda: {"ratio": 2.0})


class StrategyConfig(BaseModel):
    """Complete strategy configuration produced by LLM extraction."""

    name: str = "Custom Strategy"
    entry_conditions: List[Condition]
    exit_conditions: List[Condition]
    position_sizing: PositionSizing = Field(default_factory=PositionSizing)
    stop_loss: StopLoss = Field(default_factory=StopLoss)
    take_profit: Optional[TakeProfit] = None
    timeframe: str = "1d"
