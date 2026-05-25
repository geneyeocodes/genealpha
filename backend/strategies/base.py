"""
Kept for backward compatibility. The base class now wraps the config-driven engine.
"""

from typing import Optional, Dict, Any
from .config_schema import StrategyConfig
from .engine import StrategyEngine


class StrategyBase:
    """
    Config-driven strategy base class.
    Instead of subclassing with hardcoded logic, instantiate with a StrategyConfig.
    """

    def __init__(self, config: StrategyConfig | dict):
        if isinstance(config, dict):
            config = StrategyConfig(**config)
        self.config = config
        self._engine = StrategyEngine(config)

    def generate_signal(self, data) -> Optional[dict]:
        """Generate a trading signal from market data."""
        signals = self._engine.generate_signals(data)
        if signals.empty:
            return None
        last = signals.iloc[-1]
        if last["signal"] == "buy":
            return {"side": "buy", "signal": "entry", "price": float(last["close"])}
        elif last["signal"] in ("sell", "stop_loss"):
            return {"side": "sell", "signal": last["signal"], "price": float(last["close"])}
        return None

    def backtest(self, data, initial_capital: float = 10000.0) -> dict:
        """Run a historical backtest."""
        return self._engine.backtest(data, initial_capital)

    def get_params(self) -> dict:
        """Return current config as dict."""
        return self.config.model_dump(mode="json")

    @classmethod
    def param_schema(cls) -> dict:
        """Return the JSON schema for strategy config."""
        return StrategyConfig.model_json_schema()
