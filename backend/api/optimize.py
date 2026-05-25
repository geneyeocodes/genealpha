from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..optimizer.optimizer import run_optimization
from ..strategies import StrategyConfig

router = APIRouter()


class OptimizationRunRequest(BaseModel):
    config: dict
    symbol: str
    total_trials: int = 240


class OptimizationRunResponse(BaseModel):
    best_params: dict
    best_sharpe: float
    best_return: float | None
    best_drawdown: float | None
    top_results: list


@router.post("/", response_model=OptimizationRunResponse)
async def run_optimization_endpoint(data: OptimizationRunRequest):
    """Run hyperparameter optimization on a strategy config."""
    try:
        # Validate config
        StrategyConfig(**data.config)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid strategy config: {e}")

    best_params, best_value, all_results = run_optimization(
        config=data.config,
        symbol=data.symbol,
        n_trials=data.total_trials,
    )

    return OptimizationRunResponse(
        best_params=best_params,
        best_sharpe=best_value,
        best_return=all_results[0].get("total_return_pct") if all_results else None,
        best_drawdown=all_results[0].get("max_drawdown_pct") if all_results else None,
        top_results=all_results[:20],
    )
