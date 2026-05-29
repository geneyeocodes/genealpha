export interface Bot {
  id: string;
  name: string;
  symbol: string;
  status: "running" | "stopped" | "optimizing" | "backtesting" | "error";
  account_mode: "paper" | "live";
  order_type: "market" | "limit" | "moc";
  max_position_size: number;
  max_daily_loss: number;
  script_name: string;
  script_params: Record<string, number>;
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
  total_pnl: number;
  max_drawdown: number;
  profitable_trades: number;
  total_trades: number;
  profit_factor: number | null;
  sharpe_ratio: number;
  final_capital: number;
  equity_curve: number[];
  trades?: Array<{
    entry_price: number;
    exit_price: number;
    pnl: number;
    return_pct: number;
  }>;
  id?: string;
  bot_id?: string;
  created_at?: string;
}

export interface OptimizationResult {
  best_params: Record<string, number>;
  best_composite_score: number;
  best_total_pnl: number;
  best_max_drawdown: number;
  best_profitable_trades: number;
  best_profit_factor: number | null;
  top_results: Array<OptimizationTopResult>;
}

export interface OptimizationTopResult {
  params: Record<string, number>;
  composite_score: number;
  total_pnl: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  total_trades: number;
  profitable_trades: number;
  profit_factor: number | null;
}

export interface StrategyScript {
  name: string;
  description: string;
  params: Record<string, ScriptParamSpec>;
  param_count: number;
}

export interface ScriptParamSpec {
  type: "int" | "float";
  min: number;
  max: number;
  default: number;
  description: string;
}

export interface ExtractResponse {
  script_name: string;
  param_count: number;
  params: Record<string, ScriptParamSpec>;
  source_code: string;
}

export type PageTab = "dashboard" | "idea" | "optimize" | "deploy";
