# GeneAlpha

**Algorithmic trading, backtesting, and automated deployment platform.**

GeneAlpha lets you describe a trading idea in plain English, extract a structured strategy via AI, backtest it against historical data, optimize its parameters, and deploy it as an automated bot to Interactive Brokers — all from a web UI.

## Tech Stack

| Layer    | Technology                           |
|----------|--------------------------------------|
| Frontend | React 19, TypeScript, Vite, Tailwind v4, Zustand, TanStack Query, Recharts |
| Backend  | Python 3, FastAPI, SQLAlchemy (async), Pydantic |
| Database | SQLite (via aiosqlite)              |
| Market   | yFinance (free), Interactive Brokers (ib_insync) |
| AI       | Anthropic Claude / OpenAI GPT        |
| Opt.     | Optuna (TPE sampler)                 |

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 20+

### Backend

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate  # Windows
pip install -r requirements.txt
# Edit .env with your API keys (see .env.example)
uvicorn backend.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```
Open [](http://localhost:5173)<http://localhost:5173> in your browser.

## Workflow

The app guides you through 4 steps:

### 1. Idea (Input → Extract)

Paste a trading idea as free-form text, a YouTube URL, a PDF document, or strategy code. The backend's `extractor` module sends it to Claude or GPT and returns a structured `StrategyConfig` — entry/exit conditions, indicator references, position sizing, stop loss, take profit, and timeframe.


### 2. Backtest

The extracted strategy is evaluated by a config-driven engine. Entry and exit conditions (crossover, crossunder, comparison, range) are computed against historical data from yFinance using technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic, OBV, VWAP). The simulation returns performance metrics — total return, Sharpe ratio, max drawdown, win rate, total trades, profit factor, and an equity curve.


### 3. Optimize

Tweak parameter ranges and run an Optuna-based hyperparameter search (~240 trials). The optimizer tests different combinations, ranks them by Sharpe ratio, and lets you pick the best configuration.

### 4. Deploy

Configure bot name, symbol, account mode (paper/live), order type, position sizing, daily loss limit, and cron schedule. Deploy to Interactive Brokers via `ib_insync`. The bot then generates live signals according to its strategy.

## Project Structure

```text
genealpha/
├── backend/            # FastAPI application
│   ├── main.py         # App entry point
│   ├── api/            # REST + WebSocket endpoints
│   ├── core/           # Config, DB, models, schemas, datafeed, IBKR
│   ├── strategies/     # Config-driven strategy engine
│   ├── extractor/      # AI-powered idea extraction
│   └── optimizer/      # Hyperparameter optimization
├── frontend/           # React + Vite SPA
│   └── src/
│       ├── App.tsx     # Root component, tab routing, WebSocket
│       ├── pages/      # Dashboard, Idea, Optimize, Deploy
│       ├── components/ # Navbar, BotTable, MetricCard
│       ├── api/        # HTTP + WebSocket clients
│       └── types/      # TypeScript interfaces
├── plans/              # Architecture mockups and diagrams
└── README.md           # This file
```

## API Overview

All endpoints live under `http://localhost:8000/api/v1/`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/health` | Health check |
| **GET** | `/api/v1/bots` | List all bots |
| **GET** | `/api/v1/bots/{bot_id}` | Get a single bot |
| **POST** | `/api/v1/bots` | Create a bot |
| **PATCH** | `/api/v1/bots/{bot_id}` | Update a bot |
| **DELETE** | `/api/v1/bots/{bot_id}` | Delete a bot |
| **POST** | `/api/v1/bots/{bot_id}/start` | Start a bot |
| **POST** | `/api/v1/bots/{bot_id}/stop` | Stop a bot |
| **GET** | `/api/v1/strategies/schema` | Get strategy config JSON schema |
| **GET** | `/api/v1/strategies/indicators` | List supported indicators |
| **POST** | `/api/v1/strategies/backtest` | Run a backtest from a strategy config |
| **GET** | `/api/v1/backtest` | List backtest results |
| **GET** | `/api/v1/backtest/{backtest_id}` | Get a single backtest result |
| **POST** | `/api/v1/backtest` | Run a backtest (with symbol + date range) |
| **POST** | `/api/v1/optimize` | Run hyperparameter optimization |
| **WS** | `/api/v1/ws/live` | Real-time bot status updates |

## Environment Variables

See `backend/.env`:

- `DATABASE_URL` — SQLite path (default: `sqlite+aiosqlite:///genealpha.db`)
- `IBKR_HOST` / `IBKR_PORT` — Interactive Brokers TWS/IB Gateway
- `POLYGON_API_KEY` — (reserved) alternative market data
- `ANTHROPIC_API_KEY` — for Claude-based strategy extraction
- `OPENAI_API_KEY` — fallback AI provider

Frontend uses Vite env vars `VITE_API_BASE` and `VITE_WS_BASE` (defaults to `http://localhost:8000/api/v1` and `ws://localhost:8000/api/v1` respectively).
