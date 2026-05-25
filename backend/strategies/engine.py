"""
Config-driven strategy engine.
Evaluates a StrategyConfig against market data to generate signals and backtest results.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from .config_schema import StrategyConfig, Condition, IndicatorRef, IndicatorParams


class IndicatorCalculator:
    """Computes technical indicators from OHLCV data."""

    @staticmethod
    def compute(data: pd.DataFrame, indicator: IndicatorRef) -> pd.Series:
        name = indicator.name.lower()
        params = indicator.params
        source = data[params.source] if params.source in data.columns else data["close"]
        period = params.period if params.period is not None else 14

        if name == "sma":
            return source.rolling(window=period).mean()
        elif name == "ema":
            return source.ewm(span=period, adjust=False).mean()
        elif name == "rsi":
            delta = source.diff()
            gain = delta.where(delta > 0, 0.0)
            loss = (-delta).where(delta < 0, 0.0)
            avg_gain = gain.rolling(window=period).mean()
            avg_loss = loss.rolling(window=period).mean()
            rs = avg_gain / avg_loss.replace(0, np.nan)
            rsi = 100 - (100 / (1 + rs))
            return rsi
        elif name == "macd":
            fast = source.ewm(span=12, adjust=False).mean()
            slow = source.ewm(span=26, adjust=False).mean()
            macd_line = fast - slow
            signal = macd_line.ewm(span=9, adjust=False).mean()
            return macd_line - signal  # histogram
        elif name == "bollinger":
            sma = source.rolling(window=period).mean()
            std = source.rolling(window=period).std()
            stddev = params.stddev if params.stddev is not None else 2.0
            upper = sma + stddev * std
            lower = sma - stddev * std
            bb_width = upper - lower
            return (source - lower) / bb_width.replace(0, np.nan)
        elif name == "atr":
            high_low = data["high"] - data["low"]
            high_close = (data["high"] - data["close"].shift()).abs()
            low_close = (data["low"] - data["close"].shift()).abs()
            tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            return tr.rolling(window=period).mean()
        elif name == "stochastic":
            low_min = data["low"].rolling(window=period).min()
            high_max = data["high"].rolling(window=period).max()
            k = 100 * (data["close"] - low_min) / (high_max - low_min).replace(0, np.nan)
            return k
        elif name == "obv":
            obv = (source.diff().apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0)) * data["volume"]).cumsum()
            return obv
        elif name == "volume":
            return data["volume"]
        elif name == "vwap":
            return (data["volume"] * data["close"]).cumsum() / data["volume"].cumsum().replace(0, np.nan)
        elif name == "price":
            return source
        else:
            raise ValueError(f"Unknown indicator: {name}")


class ConditionEvaluator:
    """Evaluates conditions against a data row."""

    @staticmethod
    def evaluate(row: pd.Series, condition: Condition, series_cache: Dict[str, pd.Series]) -> bool:
        if condition.type == "and":
            return all(ConditionEvaluator.evaluate(row, c, series_cache) for c in (condition.conditions or []))
        elif condition.type == "or":
            return any(ConditionEvaluator.evaluate(row, c, series_cache) for c in (condition.conditions or []))
        elif condition.type == "crossover":
            if not condition.indicator or not condition.crosses_above:
                return False
            key_a = _cache_key(condition.indicator)
            key_b = _cache_key(condition.crosses_above)
            series_a = series_cache.get(key_a)
            series_b = series_cache.get(key_b)
            if series_a is None or series_b is None:
                return False
            idx = row.name
            pos = series_a.index.get_loc(idx)
            if isinstance(pos, slice):
                pos = pos.start
            elif isinstance(pos, np.ndarray):
                pos = int(pos.argmax())
            if pos == 0:
                return False
            val_a_curr = float(series_a.iat[pos])  # type: ignore
            val_b_curr = float(series_b.iat[pos])  # type: ignore
            val_a_prev = float(series_a.iat[pos - 1])  # type: ignore
            val_b_prev = float(series_b.iat[pos - 1])  # type: ignore
            return val_a_curr > val_b_curr and val_a_prev <= val_b_prev
        elif condition.type == "crossunder":
            if not condition.indicator or not condition.crosses_below:
                return False
            key_a = _cache_key(condition.indicator)
            key_b = _cache_key(condition.crosses_below)
            series_a = series_cache.get(key_a)
            series_b = series_cache.get(key_b)
            if series_a is None or series_b is None:
                return False
            idx = row.name
            pos = series_a.index.get_loc(idx)
            if isinstance(pos, slice):
                pos = pos.start
            elif isinstance(pos, np.ndarray):
                pos = int(pos.argmax())
            if pos == 0:
                return False
            val_a_curr = float(series_a.iat[pos])  # type: ignore
            val_b_curr = float(series_b.iat[pos])  # type: ignore
            val_a_prev = float(series_a.iat[pos - 1])  # type: ignore
            val_b_prev = float(series_b.iat[pos - 1])  # type: ignore
            return val_a_curr < val_b_curr and val_a_prev >= val_b_prev
        elif condition.type == "comparison":
            if condition.source == "price":
                val_a = float(row["close"])
            elif condition.indicator:
                key = _cache_key(condition.indicator)
                series = series_cache.get(key)
                if series is None:
                    return False
                val_a = float(series.at[row.name])  # type: ignore
            else:
                val_a = float(row["close"])

            if condition.compare_to_indicator:
                key_b = _cache_key(condition.compare_to_indicator)
                series_b = series_cache.get(key_b)
                if series_b is None:
                    return False
                val_b = float(series_b.at[row.name])  # type: ignore
            elif condition.value is not None:
                val_b = condition.value
            else:
                val_b = 0.0

            ops = {
                ">": lambda a, b: a > b,
                "<": lambda a, b: a < b,
                ">=": lambda a, b: a >= b,
                "<=": lambda a, b: a <= b,
                "==": lambda a, b: a == b,
                "!=": lambda a, b: a != b,
            }
            return bool(ops.get(condition.operator, lambda a, b: False)(val_a, val_b))  # type: ignore
        elif condition.type == "range":
            val = float(row["close"])
            if condition.min is not None and val < condition.min:
                return False
            if condition.max is not None and val > condition.max:
                return False
            return True
        return False


def _cache_key(indicator: IndicatorRef) -> str:
    params = indicator.params
    period = params.period if params.period is not None else 14
    return f"{indicator.name}_{period}_{params.source}_{params.stddev}"


def precompute_indicators(data: pd.DataFrame, conditions: List[Condition]) -> Dict[str, pd.Series]:
    """Precompute all needed indicators from a list of conditions."""
    cache: Dict[str, pd.Series] = {}
    _collect_indicators(conditions, cache, data)
    return cache


def _collect_indicators(conditions: List[Condition], cache: Dict[str, pd.Series], data: pd.DataFrame):
    for cond in conditions:
        if cond.type in ("and", "or") and cond.conditions:
            _collect_indicators(cond.conditions, cache, data)
            continue
        for ref in [cond.indicator, cond.crosses_above, cond.crosses_below, cond.compare_to_indicator]:
            if ref:
                key = _cache_key(ref)
                if key not in cache:
                    cache[key] = IndicatorCalculator.compute(data, ref)


class StrategyEngine:
    """
    Evaluates a StrategyConfig against market data.
    Generates signals and runs backtests.
    """

    def __init__(self, config: StrategyConfig):
        self.config = config

    def generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Returns a DataFrame with columns: timestamp, close, position, signal, entry_price, exit_price.
        position: 1=long, 0=flat
        signal: 'buy', 'sell', or None
        """
        df = data.copy()
        if "timestamp" in df.columns:
            df.set_index("timestamp", inplace=True)

        series_cache = precompute_indicators(df, self.config.entry_conditions + self.config.exit_conditions)

        signals = []
        in_position = False
        entry_price = 0.0

        for idx, row in df.iterrows():
            signal = None
            if not in_position:
                if all(ConditionEvaluator.evaluate(row, c, series_cache) for c in self.config.entry_conditions):
                    signal = "buy"
                    in_position = True
                    entry_price = float(row["close"])
            else:
                if all(ConditionEvaluator.evaluate(row, c, series_cache) for c in self.config.exit_conditions):
                    signal = "sell"
                    in_position = False
                    exit_price = float(row["close"])
                    # Apply stop loss check
                    stop = self._check_stop_loss(row, entry_price, series_cache)
                    if stop:
                        signal = "stop_loss"
            signals.append(
                {
                    "timestamp": idx,
                    "close": float(row["close"]),
                    "position": 1 if in_position else 0,
                    "signal": signal,
                    "entry_price": (
                        float(entry_price) if in_position or (signal == "sell" or signal == "stop_loss") else None
                    ),
                }
            )

        return pd.DataFrame(signals)

    def _check_stop_loss(self, row: pd.Series, entry_price: float, series_cache: Dict[str, pd.Series]) -> bool:
        sl = self.config.stop_loss
        if sl.method == "atr_multiple":
            atr_key = _cache_key(
                IndicatorRef(
                    name="atr",
                    params=IndicatorParams(period=14, source="close", stddev=2.0),
                )
            )
            atr_series = series_cache.get(atr_key)
            if atr_series is not None and row.name in atr_series.index:
                atr_val = float(atr_series.at[row.name])  # type: ignore
                multiplier = sl.params.get("multiplier", 1.5)
                stop_price = entry_price - (multiplier * atr_val)
                if float(row["low"]) <= stop_price:
                    return True
        elif sl.method == "fixed_percent":
            pct = sl.params.get("percent", 2.0)
            stop_price = entry_price * (1 - pct / 100)
            if float(row["low"]) <= stop_price:
                return True
        elif sl.method == "price_level":
            level = sl.params.get("price", entry_price * 0.98)
            if float(row["low"]) <= level:
                return True
        return False

    def backtest(self, data: pd.DataFrame, initial_capital: float = 10000.0) -> dict:
        """Run a full backtest and return performance metrics."""
        signals = self.generate_signals(data)

        if signals.empty:
            return self._empty_result()

        capital = initial_capital
        position_size = 0
        equity_curve = []
        trades = []
        peak = initial_capital

        for _, row in signals.iterrows():
            if row["signal"] == "buy":
                sizing = self.config.position_sizing
                if sizing.method == "percent_equity":
                    position_size = capital * (sizing.value / 100) / row["close"]
                elif sizing.method == "risk_percent":
                    position_size = (capital * (sizing.value / 100)) / row["close"]
                else:  # fixed_quantity
                    position_size = sizing.value
                cost = position_size * row["close"]
                capital -= cost

            elif row["signal"] in ("sell", "stop_loss"):
                proceeds = position_size * row["close"]
                capital += proceeds
                trades.append(
                    {
                        "entry_price": float(row["entry_price"] or 0),
                        "exit_price": float(row["close"]),
                        "pnl": float(
                            capital
                            - (initial_capital if not trades else initial_capital + sum(t["pnl"] for t in trades))
                        ),
                    }
                )
                position_size = 0

            portfolio_value = capital + (position_size * row["close"])
            equity_curve.append({"timestamp": row["timestamp"], "equity": float(portfolio_value)})
            peak = max(peak, portfolio_value)

        total_return = ((capital - initial_capital) / initial_capital) * 100
        returns = pd.Series([e["equity"] for e in equity_curve]).pct_change().dropna()
        sharpe = float((returns.mean() / returns.std() * np.sqrt(252))) if len(returns) > 0 and returns.std() > 0 else 0
        max_dd = min((e["equity"] / peak) - 1 for e in equity_curve) if equity_curve else 0
        win_rate = (sum(1 for t in trades if t["pnl"] > 0) / len(trades)) * 100 if trades else 0
        total_trades = len(trades)
        avg_hold = sum(1 for _ in trades) / total_trades if total_trades > 0 else 0
        gross_profit = sum(t["pnl"] for t in trades if t["pnl"] > 0)
        gross_loss = abs(sum(t["pnl"] for t in trades if t["pnl"] < 0))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

        return {
            "total_return_pct": round(total_return, 2),
            "sharpe_ratio": round(sharpe, 2),
            "max_drawdown_pct": round(max_dd * 100, 2),
            "win_rate_pct": round(win_rate, 2),
            "total_trades": total_trades,
            "avg_hold_periods": round(avg_hold, 2),
            "profit_factor": round(profit_factor, 2) if profit_factor != float("inf") else None,
            "final_capital": round(capital, 2),
            "equity_curve": equity_curve,
            "trades": trades[:50],
        }

    def _empty_result(self) -> dict:
        return {
            "total_return_pct": 0,
            "sharpe_ratio": 0,
            "max_drawdown_pct": 0,
            "win_rate_pct": 0,
            "total_trades": 0,
            "avg_hold_periods": 0,
            "profit_factor": None,
            "final_capital": 0,
            "equity_curve": [],
            "trades": [],
            "error": "No signals generated. Check strategy conditions or data range.",
        }
