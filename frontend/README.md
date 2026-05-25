# GeneAlpha Frontend

React + TypeScript single-page application for the GeneAlpha trading platform. Built with Vite, Tailwind CSS v4, and TanStack Query.

## Project Structure

```text
frontend/
├── index.html              # HTML entry point
├── vite.config.ts          # Vite config (React + Tailwind plugins, host 0.0.0.0:5173)
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── eslint.config.js        # ESLint configuration
└── src/
    ├── main.tsx            # React root mount with StrictMode
    ├── App.tsx             # Root component — tab routing, WebSocket lifecycle
    ├── index.css           # Tailwind v4 entry point
    ├── api/
    │   └── client.ts       # HTTP fetch wrappers + WebSocket factory
    ├── pages/
    │   ├── Dashboard.tsx   # Overview: metrics cards + bot table
    │   ├── Idea.tsx        # Idea input (text/YouTube/PDF/code) + extraction + backtest preview
    │   ├── Optimize.tsx    # Parameter sliders + optimization run + ranked results
    │   └── Deploy.tsx      # Bot config form + deploy action
    ├── components/
    │   ├── Navbar.tsx      # Logo, tab navigation, WebSocket status indicator
    │   ├── BotTable.tsx    # Bots list with status badges and action buttons
    │   └── MetricCard.tsx  # Dashboard metric with sparkline, icon, color accent
    └── types/
        └── index.ts        # TypeScript interfaces: Bot, Trade, BacktestResult, etc.
```

## How Internal Components Work Together

### Component Tree

```text
main.tsx (React Entry)
└── <App> (Global State: activeTab, wsStatus, botsData)
    ├── <Navbar activeTab={activeTab} wsStatus={wsStatus} onTabChange={setTab} />
    │
    ├── {activeTab === "dashboard" && <Dashboard />}
    │   ├── <MetricCard /> × 4 (Total P&L, Active Bots, Open Positions, Max Drawdown)
    │   └── <BotTable bots={botsData} onStop={handleStop} onView={handleView} onDeploy={handleDeploy} />
    │
    ├── {activeTab === "idea" && <Idea />}
    │   └── (Idea Input, Extractors, & Backtest Preview)
    │
    ├── {activeTab === "optimize" && <Optimize />}
    │   └── (Parameter Sliders & Optuna Results View)
    │
    └── {activeTab === "deploy" && <Deploy />}
        └── (Bot Initialization & IBKR Config Form)
```



### `App.tsx` — Root Orchestrator

- Maintains `activeTab` state (`"dashboard"` | `"idea"` | `"optimize"` | `"deploy"`)
- Manages a **WebSocket** connection to `ws://localhost:8000/api/v1/ws/live` with auto-reconnect on 3s interval
- Tracks `wsStatus` ("connecting" | "connected" | "disconnected") and passes it to Navbar
- Uses a `transitionKey` counter to trigger CSS re-mount animations on tab change
- Renders `Navbar` + active page + footer

### Pages

| Page | Backend Endpoints Used | Key UI |
|------|----------------------|--------|
| **Dashboard** | `GET /api/v1/bots` (list all bots) | 4 MetricCards (P&L, active bots, positions, drawdown) + BotTable with stop/view/deploy actions |
| **Idea** | (simulated — would call `POST /extract`, `POST /backtest`) | Text/YouTube/PDF/code input selector → "Extract Strategy" button → extracted strategy display → mock backtest results panel (return, Sharpe, drawdown, win rate, equity curve SVG) |
| **Optimize** | (simulated — would call `POST /optimize`) | Parameter range sliders → "Run Optimization" button with progress bar → ranked results table (top 5 param sets with Sharpe, return, drawdown, deploy button) |
| **Deploy** | (simulated — would call `POST /bots`) | Bot name, symbol, account mode (select), order type (select), position sizing inputs, cron schedule → deploy confirmation panel with action button |

### Components

| Component | Props | Responsibilities |
|-----------|-------|-----------------|
| **Navbar** | `activeTab`, `onTabChange`, `wsStatus` | Logo, 4 tab buttons with active indicator underline, connection status dot (green=connected, red=disconnected, yellow=connecting) + "LIVE"/"OFFLINE"/"SYNC" label + "PAPER" indicator |
| **BotTable** | `bots: Bot[]`, `onStop`, `onView`, `onDeploy` | Renders bots in a table with columns: name, strategy, symbol, status (color-coded badge with pulsing dot when running), return, Sharpe, drawdown, actions (Stop for running, Deploy for stopped/error, View for others). Empty state shows a prompt to create a bot from the Idea tab. Each row has staggered fade-in animation. |
| **MetricCard** | `label`, `value`, `sub`, `color` | Card with top accent bar, colored SVG icon, value text, subtitle, and sparkline SVG chart. 5 color themes: green/blue/red/amber/purple. Hover glow effect. |

### API Client (`api/client.ts`)

Thin fetch wrapper — no Axios, no React Query in the actual HTTP calls (TanStack Query is in package.json but not actively used in current code):

- **`apiGet<T>(path)`** → `GET ${API_BASE}${path}`, returns `T`
- **`apiPost<T>(path, body?)`** → `POST`, JSON body
- **`apiPatch<T>(path, body)`** → `PATCH`, JSON body
- **`apiDelete(path)`** → `DELETE`
- **`createWebSocket()`** → returns `WebSocket` connected to `ws://localhost:8000/api/v1/ws/live`

`API_BASE` defaults to `http://localhost:8000/api/v1`, overridable via `VITE_API_BASE` env var.

### TypeScript Types (`types/index.ts`)

```typescript
interface Bot { id, name, symbol, status, account_mode, order_type, max_position_size, max_daily_loss, strategy_name, strategy_params, schedule_cron, created_at }
interface Trade { id, bot_id, symbol, side, quantity, price, pnl, timestamp }
interface BacktestResult { id, bot_id, total_return, sharpe_ratio, max_drawdown, win_rate, total_trades, avg_hold_days, profit_factor, equity_curve, created_at }
interface OptimizationResult { id, bot_id, total_trials, best_params, best_sharpe, best_return, best_drawdown, results, created_at }
interface ExtractedStrategy { strategy_name, entry_conditions, exit_conditions, position_sizing, stop_loss, parameters }
type PageTab = "dashboard" | "idea" | "optimize" | "deploy"
```

### Running the Frontend

```bash
cd frontend
npm install
npm run dev        # Development server at http://localhost:5173
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run lint       # ESLint check
```

### Environment Variables (Vite)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `VITE_API_BASE` | `http://localhost:8000/api/v1` | Backend REST API base URL |
| `VITE_WS_BASE` | `ws://localhost:8000/api/v1` | Backend WebSocket base URL |
Create a .env file in the frontend root to override them.