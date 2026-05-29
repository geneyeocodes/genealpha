"""
SMA Crossover strategy with RSI filter.
Entry: Fast SMA crosses above Slow SMA AND RSI > 50
Exit: Fast SMA crosses below Slow SMA OR RSI < 40
"""

import pandas as pd
import numpy as np
from .base import strategy_spec


@strategy_spec(
    name="SMA Crossover",
    description="SMA crossover strategy with RSI confirmation filter",
    params={
        "fast_period": {
            "type": "int",
            "min": 5,
            "max": 50,
            "default": 20,
            "description": "Fast SMA period",
        },
        "slow_period": {
            "type": "int",
            "min": 50,
            "max": 200,
            "default": 50,
            "description": "Slow SMA period",
        },
        "rsi_period": {
            "type": "int",
            "min": 7,
            "max": 28,
            "default": 14,
            "description": "RSI period for confirmation",
        },
        "rsi_entry_threshold": {
            "type": "float",
            "min": 30.0,
            "max": 70.0,
            "default": 50.0,
            "description": "RSI must be above this to enter",
        },
        "rsi_exit_threshold": {
            "type": "float",
            "min": 20.0,
            "max": 60.0,
            "default": 40.0,
            "description": "Exit when RSI falls below this",
        },
    },
)
def sma_crossover(data: pd.DataFrame, params: dict) -> dict:
    """Generate entry/exit signals for SMA crossover strategy."""
    fast = params.get("fast_period", 20)
    slow = params.get("slow_period", 50)
    rsi_period = params.get("rsi_period", 14)
    rsi_entry = params.get("rsi_entry_threshold", 50.0)
    rsi_exit = params.get("rsi_exit_threshold", 40.0)

    close = data["close"]

    # Indicators
    sma_fast = close.rolling(window=fast).mean()
    sma_slow = close.rolling(window=slow).mean()

    # RSI calculation
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=rsi_period).mean()
    avg_loss = loss.rolling(window=rsi_period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))

    # Signals
    sma_cross_above = (sma_fast > sma_slow) & (sma_fast.shift(1) <= sma_slow.shift(1))
    sma_cross_below = (sma_fast < sma_slow) & (sma_fast.shift(1) >= sma_slow.shift(1))

    entries = sma_cross_above & (rsi > rsi_entry)
    exits = sma_cross_below | (rsi < rsi_exit)

    return {"entries": entries, "exits": exits}
