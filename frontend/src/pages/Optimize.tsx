import { useState, useEffect } from "react";
import type { StrategyScript, PageTab, OptimizationResult, OptimizationTopResult } from "../types";
import { apiGet, apiPost } from "../api/client";

interface OptimizeProps {
  scriptName: string | null;
  scriptParams: Record<string, number> | null;
  onNavigate?: (tab: PageTab, botId?: string) => void;
}

export default function Optimize({ scriptName, scriptParams: initialParams, onNavigate }: OptimizeProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("SPY");
  const [trials, setTrials] = useState(100);
  const [selectedScript, setSelectedScript] = useState(scriptName || "sma_crossover");
  const [availableScripts, setAvailableScripts] = useState<StrategyScript[]>([]);
  const [scriptSpec, setScriptSpec] = useState<StrategyScript | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

  useEffect(() => {
    apiGet<{ scripts: StrategyScript[] }>("/strategies/scripts")
      .then((data) => {
        setAvailableScripts(data.scripts);
        if (!scriptName && data.scripts.length > 0) {
          setSelectedScript(data.scripts[0].name);
        }
      })
      .catch(() => {});
  }, [scriptName]);

  useEffect(() => {
    if (!selectedScript) return;
    apiGet<StrategyScript>(`/scripts/${selectedScript}`)
      .then(setScriptSpec)
      .catch(() => {});
  }, [selectedScript]);

  const handleRun = async () => {
    setRunning(true);
    setProgress(0);
    setError(null);
    setResult(null);
    setDeployError(null);

    let progressValue = 0;
    const progressInterval = setInterval(() => {
      progressValue = Math.min(progressValue + Math.random() * 6, 95);
      setProgress(progressValue);
    }, 500);

    try {
      const res = await fetch(`${apiBase}/optimize/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script_name: selectedScript,
          symbol,
          total_trials: trials,
          initial_capital: 10000,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Optimization failed");
      }
      const data: OptimizationResult = await res.json();
      setResult(data);
      setProgress(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimization failed");
    } finally {
      clearInterval(progressInterval);
      setRunning(false);
    }
  };

  const handleDeployBest = async () => {
    if (!result || !scriptSpec) return;
    setDeploying(true);
    setDeployError(null);
    try {
      const bot = await apiPost<{ id: string }>("/bots/", {
        name: selectedScript,
        symbol,
        script_name: selectedScript,
        script_params: result.best_params,
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

  const paramKeys = scriptSpec ? Object.keys(scriptSpec.params) : [];
  const topResults: OptimizationTopResult[] = result?.top_results || [];

  const formatVal = (v: number | undefined | null): string => {
    if (v == null) return "-";
    return v % 1 === 0 ? String(v) : v.toFixed(2);
  };

  return (
    <div className="grid grid-cols-2 gap-3 items-start">
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
        <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-1">Optimization Settings</div>
        <div className="space-y-2.5 mb-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted w-24">Script</label>
            <select value={selectedScript} onChange={(e) => setSelectedScript(e.target.value)} className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-blue">
              {availableScripts.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted w-24">Symbol</label>
            <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-blue" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted w-24">Trials</label>
            <input type="number" value={trials} onChange={(e) => setTrials(Math.max(10, Number(e.target.value)))} min={10} max={500} className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-blue" />
          </div>
        </div>

        {scriptSpec && (
          <div className="mb-3">
            <div className="text-[10px] text-muted mb-1">PARAMETERS TO OPTIMIZE ({paramKeys.length})</div>
            <div className="flex flex-wrap gap-1">
              {paramKeys.map((key) => (
                <span key={key} className="text-[10px] font-['JetBrains_Mono'] px-1.5 py-0.5 rounded bg-dark-700 border border-dark-600 text-amber">
                  {key.replace(/_/g, " ")} [{scriptSpec.params[key].min}–{scriptSpec.params[key].max}]
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button onClick={handleRun} disabled={running || !selectedScript} className="relative text-xs font-medium px-3 py-1.5 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden">
            {running ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                </svg>
                Running...
              </span>
            ) : (
              "Run Optimization ↗"
            )}
          </button>
          <span className="text-[10px] text-muted ml-2">~{trials} trials</span>
          {running && (
            <div className="w-full bg-dark-700 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-linear-to-r from-accent to-blue rounded-full transition-all duration-300" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          )}
          {error && <div className="text-[10px] text-red mt-1">{error}</div>}
        </div>

        <div className="mt-3 text-[10px] text-accent font-medium">Objective: Composite Score (40% Sharpe + 25% Return − 20% DD + 15% Win Rate)</div>
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
        <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Optimization Results</div>

        {result && (
          <>
            <div className="bg-linear-to-br from-[#22d3a510] to-[#0f4a3720] border border-accent/30 rounded-lg p-2.5 mb-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] text-accent font-semibold tracking-wider uppercase">🏆 Best Result</div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#a78bfa18] border border-[#4a3a8a] text-purple font-medium">Score: {result.best_composite_score.toFixed(4)}</span>
              </div>
              <div className="flex gap-3 text-[11px] font-['JetBrains_Mono'] flex-wrap mt-1">
                <span className="text-text-dim">
                  PnL:{" "}
                  <span className="text-accent">
                    {result.best_total_pnl >= 0 ? "+" : ""}
                    {result.best_total_pnl}%
                  </span>
                </span>
                <span className="text-text-dim">
                  DD: <span className="text-red">{result.best_max_drawdown}%</span>
                </span>
                <span className="text-text-dim">
                  Wins: <span className="text-accent">{result.best_profitable_trades}</span>
                </span>
                <span className="text-text-dim">
                  PF: <span className="text-amber">{result.best_profit_factor ?? "∞"}</span>
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(result.best_params).map(([key, val]) => (
                  <span key={key} className="text-[10px] font-['JetBrains_Mono'] px-1.5 py-0.5 rounded bg-dark-700 border border-dark-600 text-amber">
                    {key.replace(/_/g, " ")}: {formatVal(val)}
                  </span>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-dark-600">
                <button onClick={handleDeployBest} disabled={deploying} className="relative text-xs font-medium px-4 py-1.5 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden">
                  {deploying ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Creating bot...
                    </span>
                  ) : (
                    "🚀 Create Bot & Deploy"
                  )}
                </button>
                {deployError && <div className="mt-1 text-[10px] text-red">{deployError}</div>}
              </div>
            </div>

            <div className="flex gap-1.5 mb-2.5 flex-wrap">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#22d3a518] text-accent border-accent-dim">{trials} trials</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#4e9eff18] text-blue border-[#0f2a4a]">Optuna TPE</span>
            </div>
          </>
        )}

        {topResults.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">#</th>
                  {paramKeys.map((key) => (
                    <th key={key} className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">
                      {key.replace(/_/g, " ")}
                    </th>
                  ))}
                  <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">Score</th>
                  <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">PnL</th>
                  <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">DD</th>
                  <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">Wins</th>
                  <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">PF</th>
                </tr>
              </thead>
              <tbody>
                {topResults.map((r, i) => (
                  <tr key={i} className={i === 0 ? "bg-[#22d3a518]" : "hover:bg-dark-700 transition-colors"}>
                    <td className="py-1.5 px-2 border-b border-dark-600">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-muted font-['JetBrains_Mono']">{i + 1}</span>}</td>
                    {paramKeys.map((key) => (
                      <td key={key} className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono']">
                        {formatVal(r.params?.[key])}
                      </td>
                    ))}
                    <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-accent font-semibold">{r.composite_score.toFixed(4)}</td>
                    <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-accent">{(r.total_pnl >= 0 ? "+" : "") + r.total_pnl}%</td>
                    <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-red">{r.max_drawdown}%</td>
                    <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-accent">
                      {r.profitable_trades}/{r.total_trades}
                    </td>
                    <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-amber">{r.profit_factor ?? "∞"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2a3050" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            {running ? "Optimizing..." : "Run an optimization to see results here."}
          </div>
        )}
      </div>
    </div>
  );
}
