"""
Composite objective function for strategy optimization.
Returns a single balanced score combining all key metrics.
"""

import numpy as np


def compute_composite_score(result: dict) -> float:
    """Weighted composite: balances Sharpe, return, drawdown, win rate, profit factor."""
    sharpe = result.get("sharpe_ratio", 0)
    total_return = result.get("total_return_pct", 0)
    max_dd = result.get("max_drawdown_pct", 0)
    win_rate = result.get("win_rate_pct", 0)
    profit_factor = result.get("profit_factor") or 0

    # Normalize each metric to roughly 0-1 range
    sharpe_norm = max(0, min(sharpe / 5.0, 1.0))
    return_norm = max(0, min(total_return / 200.0, 1.0))
    dd_norm = max(0, min(max_dd / 50.0, 1.0))
    win_norm = win_rate / 100.0
    pf_norm = max(0, min(profit_factor / 10.0, 1.0))

    # Weighted composite: 40% Sharpe + 25% Return − 20% Drawdown + 10% Win Rate + 5% Profit Factor
    score = sharpe_norm * 0.40 + return_norm * 0.25 - dd_norm * 0.20 + win_norm * 0.10 + pf_norm * 0.05
    return score


def check_constraints(result: dict, constraints: dict | None = None) -> bool:
    """Return True if the result passes all constraints."""
    if not constraints:
        return True
    checks = {
        "min_return": lambda r, v: r.get("total_return_pct", 0) >= v,
        "max_drawdown": lambda r, v: abs(r.get("max_drawdown_pct", 0)) <= v,
        "min_sharpe": lambda r, v: r.get("sharpe_ratio", 0) >= v,
        "min_win_rate": lambda r, v: r.get("win_rate_pct", 0) >= v,
        "min_profit_factor": lambda r, v: (r.get("profit_factor") or 0) >= v,
    }
    for key, value in constraints.items():
        check = checks.get(key)
        if check and not check(result, value):
            return False
    return True
