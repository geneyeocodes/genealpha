import { useState, useEffect } from "react";
import type { StrategyConfig } from "../types";

interface OptimizeProps {
  strategyConfig: StrategyConfig | null;
}

interface OptimizationResponse {
  best_params: Record<string, number>;
  best_sharpe: number;
  best_return: number | null;
  best_drawdown: number | null;
  top_results: Array<Record<string, unknown>>;
}

interface TopResultRow {
  [key: string]: unknown;
  sharpe: number;
  total_return_pct: number;
  max_drawdown_pct: number;
}

export default function Optimize({ strategyConfig }: OptimizeProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OptimizationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("SPY");
  const [trials, setTrials] = useState(240);

  const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

  // Extract param names from the strategy config for display
  const [paramNames, setParamNames] = useState<string[]>([]);
  useEffect(() => {
    if (!strategyConfig) return;
    const names: string[] = [];
    const walk = (obj: unknown, prefix = "") => {
      if (!obj || typeof obj !== "object") return;
      for (const [key, val] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof val === "number" && !Number.isInteger(val) && key === "period") {
          names.push(path);
        } else if (typeof val === "number") {
          names.push(path);
        } else if (typeof val === "object") {
          walk(val, path);
        }
      }
    };
    walk(strategyConfig);
    setParamNames(names);
  }, [strategyConfig]);

  const handleRun = async () => {
    if (!strategyConfig) return;
    setRunning(true);
    setProgress(0);
    setError(null);
    setResult(null);

    // Simulate progress while waiting for the API call
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
          config: strategyConfig,
          symbol,
          total_trials: trials,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Optimization failed");
      }

      const data: OptimizationResponse = await res.json();
      setResult(data);
      setProgress(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimization failed");
    } finally {
      clearInterval(progressInterval);
      setRunning(false);
    }
  };

  const topResults: TopResultRow[] = (result?.top_results || []).map((r) => r as unknown as TopResultRow);
  const best = result;

  // Extract unique parameter column names from top results for the table
  const resultParamKeys: string[] = [];
  if (result && result.top_results.length > 0) {
    const first = result.top_results[0];
    for (const key of Object.keys(first)) {
      if (key.startsWith("config_used.") && !["sharpe", "total_return_pct", "max_drawdown_pct"].includes(key)) {
        resultParamKeys.push(key.replace("config_used.", ""));
      }
    }
  }

  const formatVal = (v: unknown): string => {
    if (typeof v === "number") {
      return v % 1 === 0 ? String(v) : v.toFixed(2);
    }
    return String(v ?? "-");
  };

  // Short param label for display
  const shortLabel = (key: string): string => {
    const parts = key.split(".");
    return parts[parts.length - 1];
  };

  return (
    <div className="grid grid-cols-2 gap-3 items-start">
      {/* Controls */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
        <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-1">Optimization Settings</div>
        <div className="text-[11px] text-muted mb-3">{strategyConfig ? <>Strategy: {strategyConfig.name}</> : <span className="text-red">No strategy loaded — parse one in Idea tab first</span>}</div>

        {/* Symbol and Trials */}
        <div className="space-y-2.5 mb-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted w-20">Symbol</label>
            <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-blue" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted w-20">Trials</label>
            <input type="number" value={trials} onChange={(e) => setTrials(Math.max(10, Number(e.target.value)))} min={10} max={1000} className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-blue" />
          </div>
        </div>

        {/* Discovered params */}
        {paramNames.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-muted mb-1">PARAMETERS TO OPTIMIZE ({paramNames.length})</div>
            <div className="flex flex-wrap gap-1">
              {paramNames.map((name) => (
                <span key={name} className="text-[10px] font-['JetBrains_Mono'] px-1.5 py-0.5 rounded bg-dark-700 border border-dark-600 text-amber">
                  {shortLabel(name)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Run button */}
        <div className="space-y-2">
          <button onClick={handleRun} disabled={running || !strategyConfig} className="relative text-xs font-medium px-3 py-1.5 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden">
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
      </div>

      {/* Results */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
        <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Optimization Results</div>

        {best && (
          <>
            {/* Best Result Summary */}
            <div className="bg-linear-to-br from-[#22d3a510] to-[#0f4a3720] border border-accent/30 rounded-lg p-2.5 mb-2.5">
              <div className="text-[10px] text-accent font-semibold tracking-wider uppercase mb-1">🏆 Best Result</div>
              <div className="flex gap-3 text-[11px] font-['JetBrains_Mono'] flex-wrap">
                <span className="text-text-dim">
                  Sharpe: <span className="text-accent">{best.best_sharpe.toFixed(2)}</span>
                </span>
                <span className="text-text-dim">
                  Return: <span className="text-accent">{best.best_return != null ? (best.best_return >= 0 ? "+" : "") + best.best_return.toFixed(1) + "%" : "N/A"}</span>
                </span>
                <span className="text-text-dim">
                  DD: <span className="text-red">{best.best_drawdown != null ? best.best_drawdown.toFixed(1) + "%" : "N/A"}</span>
                </span>
              </div>

              {/* Best params */}
              {Object.keys(best.best_params).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Object.entries(best.best_params).map(([key, val]) => (
                    <span key={key} className="text-[10px] font-['JetBrains_Mono'] px-1.5 py-0.5 rounded bg-dark-700 border border-dark-600 text-amber">
                      {shortLabel(key)}: {formatVal(val)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-1.5 mb-2.5">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#22d3a518] text-accent border-accent-dim">{trials} trials</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#4e9eff18] text-blue border-[#0f2a4a]">Optuna TPE</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#a78bfa18] text-purple border-[#4a3a8a]">Best: Sharpe {best.best_sharpe.toFixed(2)}</span>
            </div>
          </>
        )}

        {/* Results table */}
        {topResults.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">#</th>
                  {resultParamKeys.map((key) => (
                    <th key={key} className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">
                      {shortLabel(key)}
                    </th>
                  ))}
                  <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">Sharpe</th>
                  <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">Return</th>
                  <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">DD</th>
                </tr>
              </thead>
              <tbody>
                {topResults.map((r, i) => {
                  const isBest = i === 0;
                  const sharpe = Number(r.sharpe) || 0;
                  const ret = Number(r.total_return_pct) || 0;
                  const dd = Number(r.max_drawdown_pct) || 0;

                  return (
                    <tr key={i} className={isBest ? "bg-[#22d3a518]" : "hover:bg-dark-700 transition-colors"}>
                      <td className="py-1.5 px-2 border-b border-dark-600">{i === 0 ? <span>🥇</span> : i === 1 ? <span>🥈</span> : i === 2 ? <span>🥉</span> : <span className="text-muted font-['JetBrains_Mono']">{i + 1}</span>}</td>
                      {resultParamKeys.map((key) => (
                        <td key={key} className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono']">
                          {formatVal((r as Record<string, unknown>)[`config_used.${key}`])}
                        </td>
                      ))}
                      <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-accent">{sharpe.toFixed(2)}</td>
                      <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-accent">{(ret >= 0 ? "+" : "") + ret.toFixed(1)}%</td>
                      <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-red">{dd.toFixed(1)}%</td>
                    </tr>
                  );
                })}
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
