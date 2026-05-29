from fastapi import APIRouter
from . import bots, strategies, backtest, optimize, ws, scripts, extract

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(extract.router, prefix="/extract", tags=["Extract"])
api_router.include_router(bots.router, prefix="/bots", tags=["Bots"])
api_router.include_router(scripts.router, prefix="/scripts", tags=["Scripts"])
api_router.include_router(strategies.router, prefix="/strategies", tags=["Strategies"])
api_router.include_router(backtest.router, prefix="/backtest", tags=["Backtest"])
api_router.include_router(optimize.router, prefix="/optimize", tags=["Optimize"])
api_router.include_router(ws.router, prefix="/ws", tags=["WebSocket"])
