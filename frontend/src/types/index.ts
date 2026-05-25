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

export interface ExtractedStrategy {
  strategy_name: string;
  entry_conditions: string;
  exit_conditions: string;
  position_sizing: string;
  stop_loss: string;
  parameters: Record<string, number>;
}

export type PageTab = "dashboard" | "idea" | "optimize" | "deploy";
