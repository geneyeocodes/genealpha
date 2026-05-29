from .base import strategy_spec
import pandas as pd
import numpy as np

# Assuming @strategy_spec is a custom decorator defined elsewhere in your framework
@strategy_spec(
    name="Market-Neutral Statistical Arbitrage",
    description="Mean-reversion statistical arbitrage using rolling z-score to exploit temporary price deviations while remaining market-neutral.",
    params={
        "lookback": {
            "type": "int",
            "min": 10,
            "max": 200,
            "default": 60,
            "description": "Rolling window used to estimate mean and standard deviation"
        },
        "entry_z": {
            "type": "float",
            "min": 0.5,
            "max": 5.0,
            "default": 2.0,
            "description": "Z-score threshold to enter a mean-reversion trade"
        },
        "exit_z": {
            "type": "float",
            "min": 0.0,
            "max": 3.0,
            "default": 0.5,
            "description": "Z-score threshold to exit when spread reverts"
        }
    }
)
def market_neutral_stat_arb(data: pd.DataFrame, params: dict) -> dict:
    lookback = params["lookback"]
    entry_z = params["entry_z"]
    exit_z = params["exit_z"]
    
    price = data["close"]
    
    rolling_mean = price.rolling(lookback).mean()
    rolling_std = price.rolling(lookback).std()
    
    zscore = (price - rolling_mean) / rolling_std
    
    entries = zscore.abs() >= entry_z
    exits = zscore.abs() <= exit_z
    
    entries = entries.fillna(False)
    exits = exits.fillna(False)
    
    return {
        "entries": entries,
        "exits": exits
    }