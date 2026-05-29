"""
Strategy spec system.
A decorator-based approach for defining trading strategy scripts
with explicit, optimizable parameters.
"""

from typing import Callable, Dict, Any, Optional
import pandas as pd
from dataclasses import dataclass, field

# In-memory registry of all strategy specs
_registry: Dict[str, "StrategySpec"] = {}


@dataclass
class StrategySpec:
    """Metadata spec for a strategy script."""

    name: str
    description: str
    params: Dict[str, Dict[str, Any]]  # param_name -> {type, min, max, default}
    run_func: Callable  # run(data: pd.DataFrame, params: dict) -> dict
    source_code: str = ""

    @property
    def param_names(self) -> list[str]:
        return list(self.params.keys())


def strategy_spec(
    name: str,
    description: str = "",
    params: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Callable:
    """
    Decorator that registers a strategy function as a StrategySpec.

    Usage:
        @strategy_spec(name="SMA Crossover", params={
            "fast_period": {"type": "int", "min": 5, "max": 50, "default": 20},
            "slow_period": {"type": "int", "min": 50, "max": 200, "default": 50},
        })
        def sma_crossover(data, params):
            ...
    """

    def decorator(func: Callable) -> Callable:
        import inspect

        spec = StrategySpec(
            name=name,
            description=description or func.__doc__ or "",
            params=params or {},
            run_func=func,
            source_code=inspect.getsource(func),
        )
        _registry[name] = spec
        return func

    return decorator


def registry() -> Dict[str, StrategySpec]:
    """Return the full strategy registry."""
    return dict(_registry)


def get_script(name: str) -> Optional[StrategySpec]:
    """Look up a strategy by name."""
    return _registry.get(name)


def list_scripts() -> list[dict]:
    """List all registered scripts with their metadata."""
    return [
        {
            "name": spec.name,
            "description": spec.description,
            "params": spec.params,
            "param_count": len(spec.params),
        }
        for spec in _registry.values()
    ]
