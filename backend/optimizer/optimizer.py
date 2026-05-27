"""
Optimization runner.
Accepts a StrategyConfig dict and explores param variations to maximize
a composite multi-metric objective score.
"""

from ..strategies import StrategyConfig, StrategyEngine
from ..core.datafeed import fetch_historical_data
from .search_space import suggest_param_variations
from .objective import compute_composite_score, check_constraints
import optuna
import pandas as pd
import numpy as np


def deep_set(d: dict, path: str, value) -> dict:
    """Set a value in a nested dict using dot-path notation.
    Handles list indices like 'entry_conditions.0.indicator.params.period'.
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


def run_optimization(
    config: dict,
    symbol: str,
    n_trials: int = 240,
    constraints: dict | None = None,
):
    """Run hyperparameter optimization on a strategy config.

    Optimizes for a composite score (40% Sharpe + 25% Return − 20% DD + 10% Win Rate + 5% PF).

    Args:
        config: Strategy configuration dict.
        symbol: Ticker symbol for backtest data.
        n_trials: Number of Optuna trials.
        constraints: Optional dict to filter results, e.g.
            {"min_return": 10, "max_drawdown": 30, "min_sharpe": 0.5}.
    """
    base_config = StrategyConfig(**config)
    df = fetch_historical_data(symbol, "2020-01-01", "2024-12-31")
    if df is None or df.empty:
        raise ValueError("Could not fetch historical data")

    results = []

    def objective(trial):
        params_overrides = suggest_param_variations(trial, config)
        merged = dict(config)
        for path, value in params_overrides.items():
            deep_set(merged, path, value)
        trial_config = StrategyConfig(**merged)
        engine = StrategyEngine(trial_config)
        bt_result = engine.backtest(df)
        score = compute_composite_score(bt_result)

        if not check_constraints(bt_result, constraints):
            return -999.0

        results.append(
            {
                "composite_score": score,
                **bt_result,
                "config_used": merged,
            }
        )
        return score

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler())
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    results.sort(key=lambda r: r.get("composite_score", 0), reverse=True)

    return study.best_params, study.best_value, results
