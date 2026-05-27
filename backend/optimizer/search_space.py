"""
Generic param suggestion for strategy config optimization.
Discovers numeric fields in a StrategyConfig and suggests variations.
"""

import optuna
from typing import Any


def _find_numeric_params(config: Any, prefix: str = "") -> dict:
    """Recursively find numeric leaf values in a config dict.
    Properly handles list indices as integer-prefixed path segments.
    """
    params = {}
    for key, value in config.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            params.update(_find_numeric_params(value, path))
        elif isinstance(value, list):
            for i, item in enumerate(value):
                list_path = f"{path}.{i}"
                if isinstance(item, dict):
                    params.update(_find_numeric_params(item, list_path))
                elif isinstance(item, (int, float)) and not isinstance(item, bool):
                    base = abs(item) if item != 0 else 10
                    low = max(1, base * 0.5) if isinstance(item, int) and item > 0 else base * 0.5
                    high = base * 1.5
                    params[list_path] = {"type": "int" if isinstance(item, int) else "float", "low": low, "high": high}
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            base = abs(value) if value != 0 else 10
            low = max(1, base * 0.5) if isinstance(value, int) and value > 0 else base * 0.5
            high = base * 1.5
            params[path] = {"type": "int" if isinstance(value, int) else "float", "low": low, "high": high}
    return params


def suggest_param_variations(trial: optuna.Trial, config: dict) -> dict:
    """Suggest parameter variations for an optuna trial based on config structure."""
    param_space = _find_numeric_params(config)
    overrides = {}
    for path, spec in param_space.items():
        if spec["type"] == "int":
            val = trial.suggest_int(f"override_{path}", int(spec["low"]), int(spec["high"]))
        else:
            val = trial.suggest_float(f"override_{path}", spec["low"], spec["high"])
        overrides[path] = val
    return overrides
