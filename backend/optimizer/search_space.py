"""
Generic param suggestion for strategy config optimization.
Discovers numeric fields in a StrategyConfig and suggests variations.
"""

import optuna


def _find_numeric_params(config: dict, prefix: str = "") -> dict:
    """Recursively find numeric leaf values in a config dict."""
    params = {}
    for key, value in config.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            params.update(_find_numeric_params(value, path))
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            # Determine plausible range: ±50% of value, min 1 for ints
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
