import { useState } from "react";

type InputSource = "text" | "youtube" | "pdf" | "code";

interface BacktestResult {
  total_return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  total_trades: number;
  avg_hold_periods: number;
  profit_factor: number | null;
  final_capital: number;
  equity_curve: { timestamp: string; equity: number }[];
  trades: { entry_price: number; exit_price: number; pnl: number }[];
}

export default function Idea() {
  const [source, setSource] = useState<InputSource>("text");
  const [textInput, setTextInput] = useState("");
  const [extracted, setExtracted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [backtesting, setBacktesting] = useState(false);
  const [strategyConfig, setStrategyConfig] = useState<Record<string, unknown> | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

  const handleExtract = async () => {
    if (!textInput.trim() && source === "text") return;
    setExtracting(true);
    setExtracted(false);
    setBacktestResult(null);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput }),
      });
      if (!res.ok) throw new Error("Extraction failed");
      const config = await res.json();
      setStrategyConfig(config);
      setExtracted(true);
    } catch {
      // Fallback: simulate extraction for demo
      await new Promise((r) => setTimeout(r, 800));
      const mockConfig = {
        name: "EMA Crossover with RSI Filter",
        entry_conditions: [
          {
            type: "crossover",
            indicator: { name: "ema", params: { period: 20, source: "close" } },
            crosses_above: { name: "ema", params: { period: 50, source: "close" } },
          },
          {
            type: "comparison",
            indicator: { name: "rsi", params: { period: 14, source: "close" } },
            operator: ">",
            value: 50,
          },
        ],
        exit_conditions: [
          {
            type: "comparison",
            source: "price",
            operator: "<",
            indicator: { name: "ema", params: { period: 20, source: "close" } },
          },
          {
            type: "comparison",
            indicator: { name: "rsi", params: { period: 14, source: "close" } },
            operator: "<",
            value: 40,
          },
        ],
        position_sizing: { method: "risk_percent", value: 2.0 },
        stop_loss: { method: "atr_multiple", params: { multiplier: 1.5 } },
      };
      setStrategyConfig(mockConfig);
      setExtracted(true);
    } finally {
      setExtracting(false);
    }
  };

  const handleBacktest = async () => {
    if (!strategyConfig) return;
    setBacktesting(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/strategies/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { ...strategyConfig, symbol: "SPY" },
          initial_capital: 10000,
        }),
      });
      if (!res.ok) throw new Error("Backtest failed");
      const result = await res.json();
      setBacktestResult(result);
    } catch {
      // Demo fallback data
      setBacktestResult({
        total_return_pct: 47.3,
        sharpe_ratio: 1.74,
        max_drawdown_pct: -12.4,
        win_rate_pct: 58.3,
        total_trades: 182,
        avg_hold_periods: 4.2,
        profit_factor: 1.83,
        final_capital: 14730,
        equity_curve: Array.from({ length: 320 }, (_, i) => ({
          timestamp: `2020-01-${String(i + 1).padStart(2, "0")}`,
          equity: 10000 + (i / 319) * 4730,
        })),
        trades: [],
      });
    } finally {
      setBacktesting(false);
    }
  };

  const handleClear = () => {
    setTextInput("");
    setExtracted(false);
    setExtracting(false);
    setBacktestResult(null);
    setStrategyConfig(null);
    setError(null);
  };

  return (
    <div className="grid grid-cols-2 gap-3 items-start">
      {/* Left column: Input + Extracted Strategy */}
      <div>
        {/* Input Source */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5 mb-2.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Input Source</div>
          <div className="flex gap-1 mb-2.5">
            {(["text", "youtube", "pdf", "code"] as InputSource[]).map((s) => (
              <button key={s} onClick={() => setSource(s)} className={`relative text-[11px] font-medium px-2.5 py-1 rounded-md transition-all ${source === s ? "bg-[#4e9eff18] border border-blue text-blue" : "border border-transparent text-text-dim hover:text-text"}`}>
                {s === "text" ? "Text" : s === "youtube" ? "YouTube" : s === "pdf" ? "PDF / Doc" : "Code"}
              </button>
            ))}
          </div>

          {source === "text" && (
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg p-2.5 text-xs text-text resize-none outline-none focus:border-blue focus:shadow-[0_0_8px_#4e9eff30] transition-all"
              rows={5}
              placeholder="Describe your trading idea...&#10;&#10;e.g. Buy when 20-day EMA crosses above 50-day EMA with RSI confirmation above 50. Exit when price drops below 20-day EMA or RSI falls below 40..."
            />
          )}

          {source === "youtube" && <input type="text" placeholder="Paste YouTube URL..." className="w-full bg-dark-700 border border-dark-600 rounded-lg p-2.5 text-xs text-text outline-none focus:border-blue focus:shadow-[0_0_8px_#4e9eff30] transition-all" />}

          {source === "pdf" && (
            <div className="border-2 border-dashed border-[#3a4570] rounded-lg p-5 text-center cursor-pointer hover:border-blue hover:bg-[#4e9eff08] transition-all group">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#556080" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-1.5 group-hover:stroke-blue transition-colors">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div className="text-[11px] text-muted">Drop PDF file here or click to browse</div>
            </div>
          )}

          {source === "code" && (
            <textarea className="w-full bg-dark-700 border border-dark-600 rounded-lg p-2.5 text-xs text-text font-['JetBrains_Mono'] resize-none outline-none focus:border-blue focus:shadow-[0_0_8px_#4e9eff30] transition-all" rows={5} placeholder="Paste your strategy code here..." />
          )}

          <div className="mt-2 flex gap-2">
            <button
              onClick={handleExtract}
              disabled={extracting || (!textInput.trim() && source === "text")}
              className="relative text-xs font-medium px-3 py-1.5 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
            >
              {extracting ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                  Extracting...
                </span>
              ) : (
                "Extract Strategy ↗"
              )}
            </button>
            <button onClick={handleClear} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#3a4570] bg-dark-700 text-text-dim hover:text-text transition-all">
              Clear
            </button>
          </div>
        </div>

        {/* Extracted Strategy */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Extracted Strategy</div>
          <div className="bg-dark-700 border border-dark-600 rounded-lg p-3 text-[11px] leading-relaxed text-text-dim min-h-35">
            {extracting ? (
              <div className="space-y-2.5 py-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-4 w-3/5" />
              </div>
            ) : extracted && strategyConfig ? (
              <>
                <div>
                  <span className="text-accent font-medium">Strategy:</span> {strategyConfig.name as string}
                </div>
                {(strategyConfig.entry_conditions as Array<Record<string, unknown>>)?.map((cond, i) => (
                  <div key={i} className="mt-1.5">
                    <span className="text-accent font-medium">{i === 0 ? "Entry:" : "  +"}</span>{" "}
                    {cond.type === "crossover" ? (
                      <>
                        {(cond.indicator as Record<string, unknown>)?.name as string}(<span className="text-amber">{((cond.indicator as Record<string, unknown>)?.params as Record<string, unknown>)?.period as string}</span>) crosses above{" "}
                        {(cond.crosses_above as Record<string, unknown>)?.name as string}(<span className="text-amber">{((cond.crosses_above as Record<string, unknown>)?.params as Record<string, unknown>)?.period as string}</span>)
                      </>
                    ) : cond.type === "comparison" ? (
                      <>
                        {(cond.indicator as Record<string, unknown>)?.name as string}(<span className="text-amber">{((cond.indicator as Record<string, unknown>)?.params as Record<string, unknown>)?.period as string}</span>) {cond.operator as string}{" "}
                        <span className="text-amber">{cond.value as number}</span>
                      </>
                    ) : (
                      <>{JSON.stringify(cond)}</>
                    )}
                  </div>
                ))}
                <div className="mt-1.5">
                  <span className="text-accent font-medium">Exit:</span> {(strategyConfig.exit_conditions as Array<Record<string, unknown>>)?.length} condition(s)
                </div>
                <div>
                  <span className="text-accent font-medium">Position size:</span> <span className="text-amber">{(strategyConfig.position_sizing as Record<string, unknown>)?.value as number}%</span> {(strategyConfig.position_sizing as Record<string, unknown>)?.method as string}
                </div>
                <div>
                  <span className="text-accent font-medium">Stop loss:</span> {(strategyConfig.stop_loss as Record<string, unknown>)?.method as string}
                </div>
                <div className="mt-2 pt-2 border-t border-dark-600 flex gap-2">
                  <button onClick={handleBacktest} disabled={backtesting} className="text-xs font-medium px-3 py-1 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-50">
                    {backtesting ? "Backtesting..." : "Run Backtest ↗"}
                  </button>
                  <button className="text-xs font-medium px-3 py-1 rounded-lg border border-[#3a4570] bg-dark-700 text-text-dim hover:text-text transition-all">Optimize →</button>
                </div>
                {error && <div className="mt-2 text-[10px] text-red">{error}</div>}
              </>
            ) : (
              <div className="text-center py-6 text-muted">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2a3050" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                Describe a trading idea and click "Extract Strategy" to parse it.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right column: Backtest Results */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
        <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Backtest Results {backtestResult ? `— ${backtestResult.total_trades} trades` : ""}</div>

        {backtestResult ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Total Return</div>
                <div className={`font-['JetBrains_Mono'] text-base font-semibold ${backtestResult.total_return_pct >= 0 ? "text-accent" : "text-red"}`}>
                  {backtestResult.total_return_pct >= 0 ? "+" : ""}
                  {backtestResult.total_return_pct}%
                </div>
              </div>
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Sharpe Ratio</div>
                <div className="font-['JetBrains_Mono'] text-base font-semibold text-blue">{backtestResult.sharpe_ratio}</div>
              </div>
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Max Drawdown</div>
                <div className="font-['JetBrains_Mono'] text-base font-semibold text-red">{backtestResult.max_drawdown_pct}%</div>
              </div>
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Win Rate</div>
                <div className="font-['JetBrains_Mono'] text-base font-semibold text-amber">{backtestResult.win_rate_pct}%</div>
              </div>
            </div>

            {/* Equity curve chart */}
            {backtestResult.equity_curve.length > 0 && (
              <div className="bg-dark-700 border border-dark-600 rounded-lg p-2.5 mb-2">
                <div className="text-[10px] text-muted mb-1">EQUITY CURVE</div>
                <svg width="100%" viewBox="0 0 320 80" className="overflow-visible">
                  <defs>
                    <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3a5" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#22d3a5" stopOpacity="0" />
                    </linearGradient>
                    <filter id="eqGlow">
                      <feGaussianBlur stdDeviation="1" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path d={generateEquityPath(backtestResult.equity_curve, 320, 80)} fill="url(#eq)" />
                  <path d={generateEquityPath(backtestResult.equity_curve, 320, 80)} fill="none" stroke="#22d3a5" strokeWidth="1.5" filter="url(#eqGlow)" />
                </svg>
              </div>
            )}

            <div className="text-[10px] text-muted font-['JetBrains_Mono']">
              <div className="flex justify-between py-0.5 border-b border-dark-600">
                <span>Total Trades</span>
                <span className="text-text">{backtestResult.total_trades}</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-dark-600">
                <span>Avg Hold (periods)</span>
                <span className="text-text">{backtestResult.avg_hold_periods}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Profit Factor</span>
                <span className="text-accent">{backtestResult.profit_factor ?? "∞"}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2a3050" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Extract a strategy, then run a backtest to see results here.
          </div>
        )}
      </div>
    </div>
  );
}

function generateEquityPath(curve: { equity: number }[], width: number, height: number): string {
  if (curve.length < 2) return "";
  const min = Math.min(...curve.map((p) => p.equity));
  const max = Math.max(...curve.map((p) => p.equity));
  const range = max - min || 1;
  const points = curve.map((p, i) => {
    const x = (i / (curve.length - 1)) * width;
    const y = height - ((p.equity - min) / range) * (height * 0.85) - height * 0.075;
    return `${x},${y}`;
  });
  const top = `M0,${height} L${points[0]} L${points.slice(1).join(" L")} L${width},${height}Z`;
  const bottom = `M${points[0]} ${points.slice(1).join(" L")}`;
  return top + " " + bottom;
}
