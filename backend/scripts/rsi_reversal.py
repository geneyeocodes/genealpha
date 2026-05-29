"""
RSI Reversal strategy.
Entry: RSI crosses above oversold threshold (30) after being below it
Exit: RSI crosses above overbought threshold (70) or returns to neutral
"""

import pandas as pd
import numpy as np
from .base import strategy_spec


@strategy_spec(
    name="RSI Reversal",
    description="Buy RSI oversold bounces, sell on overbought",
    params={
        "rsi_period": {
            "type": "int",
            "min": 5,
            "max": 28,
            "default": 14,
            "description": "RSI lookback period",
        },
        "oversold": {
            "type": "int",
            "min": 20,
            "max": 40,
            "default": 30,
            "description": "Oversold threshold (entry trigger)",
        },
        "overbought": {
            "type": "int",
            "min": 60,
            "max": 85,
            "default": 70,
            "description": "Overbought threshold (exit trigger)",
        },
        "neutral_exit": {
            "type": "int",
            "min": 40,
            "max": 60,
            "default": 50,
            "description": "Exit when RSI crosses above this neutral level",
        },
    },
)
def rsi_reversal(data: pd.DataFrame, params: dict) -> dict:
    """Generate entry/exit signals for RSI mean reversion."""
    rsi_period = params.get("rsi_period", 14)
    oversold = params.get("oversold", 30)
    overbought = params.get("overbought", 70)
    neutral = params.get("neutral_exit", 50)

    close = data["close"]

    # RSI
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=rsi_period).mean()
    avg_loss = loss.rolling(window=rsi_period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))

    # Entry: RSI was oversold, now crosses above oversold level
    was_oversold = rsi.shift(1) <= oversold
    now_above_oversold = rsi > oversold
    entries = was_oversold & now_above_oversold

    # Exit: RSI crosses above overbought OR crosses above neutral
    exits = (rsi > overbought) | ((rsi.shift(1) <= neutral) & (rsi > neutral))

    return {"entries": entries, "exits": exits}
