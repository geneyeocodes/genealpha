import { useState } from "react";
import type { StrategyConfig, ExtractResponse, BacktestResult } from "../types";

export default function Idea() {
  const [textInput, setTextInput] = useState("");
  const [chatGptResult, setChatGptResult] = useState("");
  const [extracted, setExtracted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [backtesting, setBacktesting] = useState(false);
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfig | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

  const handleGeneratePrompt = async () => {
    if (!textInput.trim()) {
      setPromptError("Please describe your trading idea first.");
      return;
    }
    setPromptError(null);

    try {
      const res = await fetch(`${apiBase}/extract/prompt-template`);
      if (!res.ok) throw new Error("Failed to fetch prompt template");
      const data = await res.json();
      const fullPrompt = data.template.replace("{text}", textInput.trim());

      await navigator.clipboard.writeText(fullPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      window.open("https://chat.openai.com", "_blank");
    } catch (e) {
      setPromptError(e instanceof Error ? e.message : "Failed to generate prompt");
    }
  };

  const handleParseStrategy = async () => {
    if (!chatGptResult.trim()) {
      setParseError("Paste the JSON from ChatGPT first.");
      return;
    }
    setExtracting(true);
    setExtracted(false);
    setBacktestResult(null);
    setParseError(null);

    try {
      const res = await fetch(`${apiBase}/extract/parse-strategy-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json_str: chatGptResult.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Parse failed");
      }

      const data: ExtractResponse = await res.json();
      setStrategyConfig(data.strategy);
      setExtracted(true);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleBacktest = async () => {
    if (!strategyConfig) return;
    setBacktesting(true);
    setBacktestError(null);

    // Compute dynamic 20-year range from today
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 20 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    try {
      const res = await fetch(`${apiBase}/strategies/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: strategyConfig,
          symbol: "SPY",
          start_date: startDate,
          end_date: endDate,
          initial_capital: 10000,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Backtest failed");
      }
      const result: BacktestResult = await res.json();
      setBacktestResult(result);
    } catch (e) {
      setBacktestError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setBacktesting(false);
    }
  };

  const handleClear = () => {
    setTextInput("");
    setChatGptResult("");
    setExtracted(false);
    setExtracting(false);
    setBacktestResult(null);
    setStrategyConfig(null);
    setPromptError(null);
    setParseError(null);
    setBacktestError(null);
    setCopied(false);
  };

  return (
    <div className="grid grid-cols-2 gap-3 items-start">
      {/* Left column: Input + Extracted Strategy */}
      <div>
        {/* Trading Idea */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5 mb-2.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Trading Idea</div>

          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg p-2.5 text-xs text-text resize-none outline-none focus:border-blue focus:shadow-[0_0_8px_#4e9eff30] transition-all"
            rows={5}
            placeholder="Describe your trading idea...&#10;&#10;e.g. Buy when 20-day EMA crosses above 50-day EMA with RSI confirmation above 50. Exit when price drops below 20-day EMA or RSI falls below 40..."
          />

          <div className="mt-2 flex gap-2">
            <button onClick={handleGeneratePrompt} className="relative text-xs font-medium px-3 py-1.5 rounded-lg border border-blue bg-[#4e9eff18] text-blue hover:bg-blue/10 transition-all">
              {copied ? "Copied! ✓" : "Generate Prompt → ChatGPT"}
            </button>
            <button onClick={handleClear} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#3a4570] bg-dark-700 text-text-dim hover:text-text transition-all">
              Clear
            </button>
          </div>
          {promptError && <div className="mt-2 text-[10px] text-red">{promptError}</div>}
        </div>

        {/* Paste ChatGPT Result */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5 mb-2.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Paste ChatGPT Result</div>
          <textarea
            value={chatGptResult}
            onChange={(e) => setChatGptResult(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg p-2.5 text-xs text-text resize-none outline-none focus:border-blue focus:shadow-[0_0_8px_#4e9eff30] transition-all"
            rows={6}
            placeholder="Paste the JSON that ChatGPT returned here..."
          />
          <div className="mt-2">
            <button onClick={handleParseStrategy} disabled={extracting} className="relative text-xs font-medium px-3 py-1.5 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden">
              {extracting ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                  Parsing...
                </span>
              ) : (
                "Parse Strategy ↗"
              )}
            </button>
          </div>
          {parseError && <div className="mt-2 text-[10px] text-red">{parseError}</div>}
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
                  <span className="text-accent font-medium">Strategy:</span> {strategyConfig.name}
                </div>
                {strategyConfig.entry_conditions?.map((cond, i) => (
                  <div key={i} className="mt-1.5">
                    <span className="text-accent font-medium">{i === 0 ? "Entry:" : "  +"}</span>{" "}
                    {cond.type === "crossover" ? (
                      <>
                        {cond.indicator?.name}(<span className="text-amber">{cond.indicator?.params?.period}</span>) crosses above {cond.crosses_above?.name}(<span className="text-amber">{cond.crosses_above?.params?.period}</span>)
                      </>
                    ) : cond.type === "crossunder" ? (
                      <>
                        {cond.indicator?.name}(<span className="text-amber">{cond.indicator?.params?.period}</span>) crosses below {cond.crosses_below?.name}(<span className="text-amber">{cond.crosses_below?.params?.period}</span>)
                      </>
                    ) : cond.type === "comparison" ? (
                      <>
                        {cond.indicator?.name}(<span className="text-amber">{cond.indicator?.params?.period}</span>) {cond.operator} <span className="text-amber">{cond.value}</span>
                      </>
                    ) : cond.type === "range" ? (
                      <>
                        {cond.indicator?.name} in range [<span className="text-amber">{cond.min}</span> – <span className="text-amber">{cond.max}</span>]
                      </>
                    ) : (
                      <>{JSON.stringify(cond)}</>
                    )}
                  </div>
                ))}
                <div className="mt-1.5">
                  <span className="text-accent font-medium">Exit:</span> {strategyConfig.exit_conditions?.length} condition(s)
                </div>
                <div>
                  <span className="text-accent font-medium">Position size:</span> <span className="text-amber">{strategyConfig.position_sizing?.value}%</span> {strategyConfig.position_sizing?.method}
                </div>
                <div>
                  <span className="text-accent font-medium">Stop loss:</span> {strategyConfig.stop_loss?.method}
                </div>
                {strategyConfig.take_profit && (
                  <div>
                    <span className="text-accent font-medium">Take profit:</span> {strategyConfig.take_profit.method}
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-dark-600 flex gap-2">
                  <button onClick={handleBacktest} disabled={backtesting} className="text-xs font-medium px-3 py-1 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-50">
                    {backtesting ? "Backtesting..." : "Run Backtest ↗"}
                  </button>
                  <button className="text-xs font-medium px-3 py-1 rounded-lg border border-[#3a4570] bg-dark-700 text-text-dim hover:text-text transition-all">Optimize →</button>
                </div>
                {backtestError && <div className="mt-2 text-[10px] text-red">{backtestError}</div>}
              </>
            ) : (
              <div className="text-center py-6 text-muted">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2a3050" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                Generate a prompt and paste ChatGPT's result here.
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
                <div className={`font-['JetBrains_Mono'] text-base font-semibold ${backtestResult.total_return >= 0 ? "text-accent" : "text-red"}`}>
                  {backtestResult.total_return >= 0 ? "+" : ""}
                  {backtestResult.total_return}%
                </div>
              </div>
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Sharpe Ratio</div>
                <div className="font-['JetBrains_Mono'] text-base font-semibold text-blue">{backtestResult.sharpe_ratio}</div>
              </div>
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Max Drawdown</div>
                <div className="font-['JetBrains_Mono'] text-base font-semibold text-red">{backtestResult.max_drawdown}%</div>
              </div>
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Win Rate</div>
                <div className="font-['JetBrains_Mono'] text-base font-semibold text-amber">{backtestResult.win_rate}%</div>
              </div>
            </div>

            {/* Equity curve chart */}
            {backtestResult.equity_curve?.length > 0 && (
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
                <span className="text-text">{backtestResult.avg_hold_days}</span>
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
            Parse a strategy, then run a backtest to see results here.
          </div>
        )}
      </div>
    </div>
  );
}

function generateEquityPath(curve: number[], width: number, height: number): string {
  if (curve.length < 2) return "";
  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const range = max - min || 1;
  const points = curve.map((p, i) => {
    const x = (i / (curve.length - 1)) * width;
    const y = height - ((p - min) / range) * (height * 0.85) - height * 0.075;
    return `${x},${y}`;
  });
  const top = `M0,${height} L${points[0]} L${points.slice(1).join(" L")} L${width},${height}Z`;
  const bottom = `M${points[0]} ${points.slice(1).join(" L")}`;
  return top + " " + bottom;
}
