from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.database import init_db
from .core.bot_runtime import manager as runtime_manager
from .api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await runtime_manager.start_all_pending()
    yield


app = FastAPI(
    title="GeneAlpha API",
    description="Algorithmic trading, backtesting, and automated deployment platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
