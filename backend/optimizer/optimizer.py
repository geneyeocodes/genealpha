"""
Optimization runner.
Accepts a StrategyConfig dict and explores param variations to maximize Sharpe.
"""

from ..strategies import StrategyConfig, StrategyEngine
from ..core.datafeed import fetch_historical_data
from .search_space import suggest_param_variations
import optuna
import pandas as pd
import numpy as np


def deep_set(d: dict, path: str, value) -> dict:
    """Set a value in a nested dict using dot-path notation.
    Handles list indices like 'entry_conditions.0.indicator.params.period'.
    Returns a new dict (immutable-style), or mutates and returns it.
    """
    parts = path.split(".")
    current = d
    for i, part in enumerate(parts[:-1]):
        if part.isdigit():
            idx = int(part)
            if isinstance(current, list):
                while len(current) <= idx:
                    current.append({})
                current = current[idx]
            else:
                current = current[int(part)]
        else:
            if part not in current:
                current[part] = {} if not parts[i + 1].isdigit() else []
            current = current[part]
    last = parts[-1]
    if last.isdigit():
        idx = int(last)
        if isinstance(current, list):
            while len(current) <= idx:
                current.append(None)
            current[idx] = value
        else:
            current[int(last)] = value
    else:
        current[last] = value
    return d


def run_optimization(config: dict, symbol: str, n_trials: int = 240):
    """Run hyperparameter optimization on a strategy config."""
    # Build base config to get param boundaries
    base_config = StrategyConfig(**config)
    df = fetch_historical_data(symbol, "2020-01-01", "2024-12-31")
    if df is None or df.empty:
        raise ValueError("Could not fetch historical data")

    results = []

    def objective(trial):
        params_overrides = suggest_param_variations(trial, config)
        # Deep-merge overrides into config so dot-paths actually set nested values
        merged = dict(config)  # shallow copy
        for path, value in params_overrides.items():
            deep_set(merged, path, value)
        trial_config = StrategyConfig(**merged)
        engine = StrategyEngine(trial_config)
        bt_result = engine.backtest(df)
        sharpe = bt_result.get("sharpe_ratio", 0)
        results.append({"sharpe": sharpe, **bt_result, "config_used": merged})
        return sharpe

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler())
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    results.sort(key=lambda r: r.get("sharpe", 0), reverse=True)

    return study.best_params, study.best_value, results
