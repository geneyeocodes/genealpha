# GeneAlpha Backend

FastAPI application providing the algorithmic trading engine: strategy extraction via AI, historical backtesting, hyperparameter optimization, and automated IBKR deployment.

## Project Structure
```text
backend/
├── main.py                 # FastAPI app — lifespan, CORS, router mount
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables
├── api/
│   ├── router.py           # Mounts all sub-routers under /api/v1
│   ├── bots.py             # CRUD for bot instances
│   ├── strategies.py       # Lists available strategies & param schemas
│   ├── backtest.py         # Runs historical backtests
│   ├── optimize.py         # Triggers hyperparameter optimization
│   └── ws.py               # WebSocket for real-time status
├── core/
│   ├── config.py           # Pydantic Settings loaded from .env
│   ├── database.py         # SQLAlchemy async engine, session, init_db
│   ├── models.py           # ORM: Bot, Trade, BacktestResult, Optimization
│   ├── schemas.py          # Pydantic request/response models
│   ├── datafeed.py         # yFinance wrappers (historical, intraday, price)
│   └── ibkr.py             # IBKRConnector — connect, place orders, positions
├── strategies/
│   ├── base.py             # Abstract StrategyBase (generate_signal, backtest, param_schema)
│   ├── ema_crossover.py    # EMA crossover with RSI filter + ATR stop
│   ├── rsi_reversion.py    # RSI mean reversion (oversold/overbought)
│   └── volatility_breakout.py # Breakout above highest high / below lowest low
├── extractor/
│   ├── llm_client.py       # Sends trading idea to Claude or GPT, parses JSON
│   ├── parser.py           # Validates and wraps into ExtractResponse
│   ├── pdf_extractor.py    # Extracts text from PDFs via PyMuPDF
│   └── youtube_extractor.py# Extracts YouTube transcripts
└── optimizer/
    ├── search_space.py     # Optuna parameter ranges per strategy
    └── optimizer.py        # Runs Optuna study, calls strategy.backtest() as objective
```


## How Internal Components Work Together

### Request Flow
```text
        [ HTTP Request ]
              │
              ▼
         main.py (FastAPI App Entry)
              │
              ▼
       api/router.py (Prefix: /api/v1)
              │
     ┌────────┼────────┬────────┐
     ▼        ▼        ▼        ▼
  api/     api/     api/     api/
  bots.py  strat.py bckts.py optim.py
     │        │        │        │
     └────────┼────────┴────────┘
              │
              ▼
       core/database.py (get_db session Async)
              │
              ▼
       core/models.py (SQLAlchemy ORM Queries)
              │
              ├─► [ strategies/ ] ──► [ core/datafeed.py ] (yFinance)
              │   (.backtest())
              │
              ├─► [ optimizer/ ] (Optuna Hyperparameters)
              │
              └─► [ core/ibkr.py ] (Live Orders via Interactive Brokers)
              │
              ▼
       core/schemas.py (Pydantic Serialization)
              │
              ▼
       [ JSON Response ]
```

### Module Responsibilities

#### `api/` — REST & WebSocket Layer

| Module | Endpoints | Key Logic |
|--------|-----------|-----------|
| `router.py` | — | Mounts all sub-routers under `/api/v1` prefix |
| `bots.py` | `GET/POST/PATCH/DELETE /bots`, `POST /bots/{id}/start`, `POST /bots/{id}/stop` | CRUD on Bot model, status transitions |
| `strategies.py` | `GET /strategies` | Introspects strategy classes via `param_schema()` |
| `backtest.py` | `GET/POST /backtest` | Looks up bot's `strategy_name`, instantiates the strategy class, calls `.backtest()`, persists `BacktestResult` |
| `optimize.py` | `GET/POST /optimize` | Calls `run_optimization()` from optimizer module, persists `Optimization` record |
| `ws.py` | `WS /ws/live` | `ConnectionManager` broadcasts messages to all connected clients |

#### `core/` — Foundation Layer

- **`config.py`** — `Settings` class inherits `pydantic_settings.BaseSettings`. Loads `DATABASE_URL`, `IBKR_HOST`, `IBKR_PORT`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` from `.env` with `@lru_cache`-decorated `get_settings()`.
- **`database.py`** — Creates async SQLAlchemy engine + `async_sessionmaker`. `init_db()` calls `Base.metadata.create_all`. `get_db()` is a FastAPI dependency that yields an `AsyncSession`.
- **`models.py`** — 4 ORM models:
  - `Bot` — name, symbol, status (enum), account_mode, order_type, max_position_size, max_daily_loss, strategy_name, strategy_params (JSON), schedule_cron. Relationships to Trade, BacktestResult, Optimization.
  - `Trade` — bot_id, symbol, side, quantity, price, pnl, timestamp.
  - `BacktestResult` — bot_id, total_return, sharpe_ratio, max_drawdown, win_rate, total_trades, avg_hold_days, profit_factor, equity_curve (JSON).
  - `Optimization` — bot_id, total_trials, best_params (JSON), best_sharpe, best_return, best_drawdown, results (JSON).
- **`schemas.py`** — Pydantic models matching the ORM models plus `ExtractRequest`/`ExtractResponse` for the AI extraction endpoint.
- **`datafeed.py`** — 3 functions around yFinance: `fetch_historical_data(symbol, start, end, interval)`, `fetch_latest_price(symbol)`, `fetch_intraday_data(symbol, period, interval)`. Returns pandas DataFrames with lowercase/snake-case columns.
- **`ibkr.py`** — `IBKRConnector` class wrapping `ib_insync`. `connect()` / `disconnect()`, `place_market_order()`, `get_positions()`, `get_account_summary()`.

#### `strategies/` — Trading Logic

All strategies inherit from `StrategyBase` which defines 4 abstract methods:

| Method | Purpose |
|--------|---------|
| `generate_signal(symbol)` | Fetches recent data, computes indicators, returns `{"side", "quantity", "price", "stop_loss"}` or `None` |
| `backtest(symbol, start, end)` | Fetches full date range, computes daily signals, calculates position-based returns, returns metrics dict |
| `get_params()` | Returns current param values |
| `param_schema()` (classmethod) | Returns param metadata (type, min, max, default) for UI sliders |

**Implementation details:**

- **EMA Crossover** — Computes fast/slow EMA, RSI, ATR. Entry when fast EMA crosses above slow EMA AND RSI > threshold. Exit when price < fast EMA or RSI < 40.
- **RSI Reversion** — Enters when RSI crosses below oversold (buy) or above overbought (sell).
- **Volatility Breakout** — Enters when price breaks above `highest_high + ATR * factor` (buy) or below `lowest_low - ATR * factor` (sell).

Backtest logic in all three follows the same pattern: compute signals → `ffill()` positions → `shift(1)` to avoid lookahead → compute daily returns → cumulative product → derive Sharpe, max drawdown, win rate, total trades.

#### `extractor/` — AI Strategy Extraction

- **`llm_client.py`** — Checks if `ANTHROPIC_API_KEY` is set → uses `AsyncAnthropic` (claude-3-5-haiku), otherwise falls back to `AsyncOpenAI` (gpt-4o-mini). Builds a prompt asking the LLM to parse the trading idea into structured JSON. Strips code fences from the response and calls `json.loads()`.
- **`parser.py`** — Maps raw dict to `ExtractResponse` Pydantic model.
- **`pdf_extractor.py`** — Uses PyMuPDF (`fitz`) to extract text from PDF bytes.
- **`youtube_extractor.py`** — Uses `youtube-transcript-api` to fetch transcript by video ID extracted from URL.

#### `optimizer/` — Hyperparameter Tuning

- **`search_space.py`** — Maps strategy names to Optuna parameter spaces (int/float ranges for each tunable parameter).
- **`optimizer.py`** — `run_optimization(strategy_name, symbol, n_trials=240)`:
  1. Fetches 5 years of historical data via `datafeed.fetch_historical_data`
  2. Creates an Optuna study with `TPESampler`, direction = maximize
  3. Objective function: `suggest_params(trial, strategy)` → instantiate strategy → `strategy.backtest()` → return Sharpe ratio
  4. Runs `n_trials` iterations
  5. Returns `(best_params, best_value, sorted_results)`

## Running Tests

```bash
cd backend
pytest
````
