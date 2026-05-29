import { useState, useEffect } from "react";
import type { StrategyScript, ExtractResponse, BacktestResult, PageTab } from "../types";
import { apiPost, apiGet } from "../api/client";

interface IdeaProps {
  onOptimize: (scriptName: string, params: Record<string, number>) => void;
  onNavigate?: (tab: PageTab, botId?: string) => void;
}

export default function Idea({ onOptimize, onNavigate }: IdeaProps) {
  const [textInput, setTextInput] = useState("");
  const [chatGptResult, setChatGptResult] = useState("");
  const [extracted, setExtracted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [backtesting, setBacktesting] = useState(false);
  const [scriptName, setScriptName] = useState("");
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [availableScripts, setAvailableScripts] = useState<StrategyScript[]>([]);
  const [selectedScript, setSelectedScript] = useState("sma_crossover");
  const [scriptSpec, setScriptSpec] = useState<StrategyScript | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, number>>({});

  const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

  useEffect(() => {
    apiGet<{ scripts: StrategyScript[] }>("/strategies/scripts")
      .then((data) => {
        setAvailableScripts(data.scripts);
        if (data.scripts.length > 0) setSelectedScript(data.scripts[0].name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedScript) return;
    apiGet<StrategyScript>(`/scripts/${selectedScript}`)
      .then((spec) => {
        setScriptSpec(spec);
        const defaults: Record<string, number> = {};
        for (const [key, val] of Object.entries(spec.params)) {
          defaults[key] = val.default;
        }
        setParamValues(defaults);
      })
      .catch(() => {});
  }, [selectedScript]);

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
      setParseError("Paste the Python code from ChatGPT first.");
      return;
    }
    setExtracting(true);
    setExtracted(false);
    setBacktestResult(null);
    setParseError(null);
    try {
      const name =
        textInput
          .trim()
          .slice(0, 30)
          .replace(/[^a-zA-Z0-9 ]/g, "") || "Custom Strategy";
      const res = await fetch(`${apiBase}/extract/parse-strategy-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, source_code: chatGptResult.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Parse failed");
      }
      const data: ExtractResponse = await res.json();
      setScriptName(data.script_name);
      setExtracted(true);
      const scriptsRes = await apiGet<{ scripts: StrategyScript[] }>("/strategies/scripts");
      setAvailableScripts(scriptsRes.scripts);
      setSelectedScript(data.script_name);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleBacktest = async () => {
    setBacktesting(true);
    setBacktestError(null);
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 20 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    try {
      const res = await fetch(`${apiBase}/strategies/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script_name: selectedScript,
          params: paramValues,
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

  const handleDeployStrategy = async () => {
    setDeploying(true);
    setDeployError(null);
    try {
      const bot = await apiPost<{ id: string }>("/bots/", {
        name: scriptName || selectedScript,
        symbol: "SPY",
        script_name: selectedScript,
        script_params: paramValues,
        account_mode: "paper",
        order_type: "market",
        max_position_size: 5000,
        max_daily_loss: 200,
        schedule_cron: "0 9 * * 1-5",
      });
      onNavigate?.("deploy", bot.id);
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : "Failed to create bot");
    } finally {
      setDeploying(false);
    }
  };

  const handleClear = () => {
    setTextInput("");
    setChatGptResult("");
    setExtracted(false);
    setExtracting(false);
    setBacktestResult(null);
    setPromptError(null);
    setParseError(null);
    setBacktestError(null);
    setCopied(false);
    setDeployError(null);
  };

  return (
    <div className="grid grid-cols-2 gap-3 items-start">
      <div>
        {/* Strategy Generator */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5 mb-2.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Trading Idea → Script Generator</div>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg p-2.5 text-xs text-text resize-none outline-none focus:border-blue focus:shadow-[0_0_8px_#4e9eff30] transition-all"
            rows={4}
            placeholder="Describe your trading idea..."
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

        {/* Paste ChatGPT Python Code */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5 mb-2.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Paste ChatGPT Python Code</div>
          <textarea
            value={chatGptResult}
            onChange={(e) => setChatGptResult(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg p-2.5 text-xs text-text resize-none outline-none focus:border-blue focus:shadow-[0_0_8px_#4e9eff30] transition-all font-['JetBrains_Mono']"
            rows={6}
            placeholder="Paste the Python strategy code that ChatGPT returned here..."
          />
          <div className="mt-2">
            <button onClick={handleParseStrategy} disabled={extracting} className="relative text-xs font-medium px-3 py-1.5 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden">
              {extracting ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                  Registering Script...
                </span>
              ) : (
                "Register Strategy Script ↗"
              )}
            </button>
          </div>
          {parseError && <div className="mt-2 text-[10px] text-red">{parseError}</div>}
        </div>

        {/* Pre-built Scripts + Params */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Select / Configure Script</div>
          <div className="flex gap-2 mb-3">
            <select value={selectedScript} onChange={(e) => setSelectedScript(e.target.value)} className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-blue">
              {availableScripts.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {scriptSpec && (
            <div className="space-y-2">
              <div className="text-[10px] text-text-dim">{scriptSpec.description}</div>
              {Object.entries(scriptSpec.params).map(([key, spec]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="text-[10px] text-muted w-28 shrink-0">{key.replace(/_/g, " ")}</label>
                  <input
                    type="number"
                    value={paramValues[key] ?? spec.default}
                    onChange={(e) => setParamValues((p) => ({ ...p, [key]: Number(e.target.value) }))}
                    min={spec.min}
                    max={spec.max}
                    step={spec.type === "float" ? 0.5 : 1}
                    className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-xs text-text outline-none focus:border-blue font-['JetBrains_Mono']"
                  />
                  <span className="text-[9px] text-muted w-12 text-right">
                    [{spec.min}–{spec.max}]
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-2 border-t border-dark-600 flex gap-2">
            <button onClick={handleBacktest} disabled={backtesting || !selectedScript} className="text-xs font-medium px-3 py-1 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-50">
              {backtesting ? "Backtesting..." : "Run Backtest ↗"}
            </button>
            <button onClick={() => onOptimize(selectedScript, paramValues)} className="text-xs font-medium px-3 py-1 rounded-lg border border-[#3a4570] bg-dark-700 text-text-dim hover:text-text transition-all">
              Optimize →
            </button>
            <button onClick={handleDeployStrategy} disabled={deploying} className="text-xs font-medium px-3 py-1 rounded-lg border border-accent bg-accent/10 text-accent hover:bg-accent-dim transition-all disabled:opacity-50">
              {deploying ? "Creating..." : "🚀 Deploy Bot"}
            </button>
          </div>
          {extracted && <div className="mt-2 text-[10px] text-accent">✓ Script "{scriptName}" registered!</div>}
          {backtestError && <div className="mt-2 text-[10px] text-red">{backtestError}</div>}
          {deployError && <div className="mt-2 text-[10px] text-red">{deployError}</div>}
        </div>
      </div>

      {/* Backtest Results */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
        <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Backtest Results {backtestResult ? `— ${backtestResult.total_trades} trades` : ""}</div>
        {backtestResult ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Total PnL</div>
                <div className={`font-['JetBrains_Mono'] text-base font-semibold ${backtestResult.total_pnl >= 0 ? "text-accent" : "text-red"}`}>
                  {backtestResult.total_pnl >= 0 ? "+" : ""}
                  {backtestResult.total_pnl}%
                </div>
              </div>
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Max Drawdown</div>
                <div className="font-['JetBrains_Mono'] text-base font-semibold text-red">-{Math.abs(backtestResult.max_drawdown)}%</div>
              </div>
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Profitable Trades</div>
                <div className="font-['JetBrains_Mono'] text-base font-semibold text-accent">
                  {backtestResult.profitable_trades}/{backtestResult.total_trades}
                </div>
              </div>
              <div className="bg-linear-to-br from-dark-800 to-dark-750 border border-dark-600 rounded-lg p-2.5">
                <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">Profit Factor</div>
                <div className="font-['JetBrains_Mono'] text-base font-semibold text-amber">{backtestResult.profit_factor ?? "∞"}</div>
              </div>
            </div>
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
                <span>Sharpe Ratio</span>
                <span className="text-blue">{backtestResult.sharpe_ratio}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Final Capital</span>
                <span className="text-text">${backtestResult.final_capital?.toFixed(2) ?? "10,000.00"}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2a3050" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Select a script, configure params, then run a backtest.
          </div>
        )}
      </div>
    </div>
  );
}

function generateEquityPath(curve: number[], width: number, height: number): string {
  if (curve.length < 2) return "";
  const min = Math.min(...curve),
    max = Math.max(...curve),
    range = max - min || 1;
  const points = curve.map((p, i) => {
    const x = (i / (curve.length - 1)) * width;
    const y = height - ((p - min) / range) * (height * 0.85) - height * 0.075;
    return `${x},${y}`;
  });
  return `M0,${height} L${points[0]} L${points.slice(1).join(" L")} L${width},${height}Z M${points[0]} ${points.slice(1).join(" L")}`;
}
