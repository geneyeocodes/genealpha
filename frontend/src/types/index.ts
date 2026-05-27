export interface Bot {
  id: string;
  name: string;
  symbol: string;
  status: "running" | "stopped" | "optimizing" | "backtesting" | "error";
  account_mode: "paper" | "live";
  order_type: "market" | "limit" | "moc";
  max_position_size: number;
  max_daily_loss: number;
  strategy_name: string;
  strategy_params: Record<string, number>;
  schedule_cron: string;
  created_at: string;
}

export interface Trade {
  id: string;
  bot_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  pnl: number | null;
  timestamp: string;
}

export interface BacktestResult {
  id: string;
  bot_id: string;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  avg_hold_days: number;
  profit_factor: number;
  equity_curve: number[];
  created_at: string;
}

export interface OptimizationResult {
  id: string;
  bot_id: string;
  total_trials: number;
  best_params: Record<string, number>;
  best_sharpe: number;
  best_return: number;
  best_drawdown: number;
  results: Array<Record<string, number>>;
  created_at: string;
}

export interface StrategyConfig {
  name: string;
  entry_conditions: Condition[];
  exit_conditions: Condition[];
  position_sizing: { method: string; value: number };
  stop_loss: { method: string; params: Record<string, unknown> };
  take_profit?: { method: string; params: Record<string, unknown> } | null;
  timeframe: string;
}

export interface Condition {
  type: "crossover" | "crossunder" | "comparison" | "range" | "and" | "or";
  indicator?: IndicatorRef | null;
  crosses_above?: IndicatorRef | null;
  crosses_below?: IndicatorRef | null;
  source?: string | null;
  operator?: string | null;
  value?: number | null;
  min?: number | null;
  max?: number | null;
  conditions?: Condition[] | null;
}

export interface IndicatorRef {
  name: string;
  params: {
    period?: number;
    source?: string;
    stddev?: number;
  };
}

/** Response from POST /api/v1/extract */
export interface ExtractResponse {
  strategy: StrategyConfig;
  source_type: string;
  raw_excerpt: string | null;
}

export type PageTab = "dashboard" | "idea" | "optimize" | "deploy";
