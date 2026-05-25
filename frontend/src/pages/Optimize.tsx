import { useState } from "react";

interface ParamState {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
}

export default function Optimize() {
  const [params, setParams] = useState<ParamState[]>([
    { name: "fast_ema", label: "fast_ema", value: 20, min: 5, max: 30 },
    { name: "slow_ema", label: "slow_ema", value: 50, min: 30, max: 100 },
    { name: "rsi_period", label: "rsi_period", value: 14, min: 7, max: 21 },
    { name: "rsi_entry", label: "rsi_entry", value: 50, min: 45, max: 65 },
    { name: "atr_mult", label: "atr_mult", value: 15, min: 10, max: 30 },
  ]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const updateParam = (name: string, value: number) => {
    setParams((prev) => prev.map((p) => (p.name === name ? { ...p, value } : p)));
  };

  const displayVal = (p: ParamState) => {
    if (p.name === "atr_mult") return (p.value / 10).toFixed(1);
    return String(p.value);
  };

  const displayMax = (p: ParamState) => {
    if (p.name === "atr_mult") return (p.max / 10).toFixed(1);
    return String(p.max);
  };

  const displayMin = (p: ParamState) => {
    if (p.name === "atr_mult") return (p.min / 10).toFixed(1);
    return String(p.min);
  };

  const handleRun = () => {
    setRunning(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setRunning(false);
          return 100;
        }
        return p + Math.random() * 8;
      });
    }, 300);
  };

  // Sample optimization results
  const results = [
    { rank: 1, fast: 12, slow: 45, rsi: 16, sharpe: 2.11, ret: "+61%", dd: "-9.8%" },
    { rank: 2, fast: 10, slow: 42, rsi: 14, sharpe: 1.98, ret: "+57%", dd: "-10.2%" },
    { rank: 3, fast: 15, slow: 50, rsi: 14, sharpe: 1.88, ret: "+54%", dd: "-11.1%" },
    { rank: 4, fast: 18, slow: 55, rsi: 16, sharpe: 1.74, ret: "+49%", dd: "-12.4%" },
    { rank: 5, fast: 20, slow: 60, rsi: 12, sharpe: 1.65, ret: "+44%", dd: "-13.8%" },
  ];

  const rankBadge = (rank: number) => {
    if (rank === 1) return <span>🥇</span>;
    if (rank === 2) return <span>🥈</span>;
    if (rank === 3) return <span>🥉</span>;
    return <span className="text-muted font-['JetBrains_Mono']">{rank}</span>;
  };

  return (
    <div className="grid grid-cols-2 gap-3 items-start">
      {/* Parameter ranges */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
        <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-1">Parameter Ranges</div>
        <div className="text-[11px] text-muted mb-3">Strategy: EMA Crossover with RSI Filter · AAPL</div>

        {params.map((p) => {
          const pct = ((p.value - p.min) / (p.max - p.min)) * 100;
          return (
            <div key={p.name} className="grid grid-cols-[140px_1fr_60px_60px] gap-2 items-center py-2 border-b border-dark-600 last:border-b-0">
              <div className="font-['JetBrains_Mono'] text-[11px] text-text-dim">{p.label}</div>
              <input type="range" min={p.min} max={p.max} value={p.value} onChange={(e) => updateParam(p.name, Number(e.target.value))} className="w-full" style={{ "--pct": `${pct}%` } as React.CSSProperties} />
              <div className="font-['JetBrains_Mono'] text-[11px] text-amber text-center">{displayVal(p)}</div>
              <div className="text-[10px] text-muted">
                {displayMin(p)}–{displayMax(p)}
              </div>
            </div>
          );
        })}

        {/* Run button with progress */}
        <div className="mt-3 space-y-2">
          <div className="flex gap-2 items-center">
            <button onClick={handleRun} disabled={running} className="relative text-xs font-medium px-3 py-1.5 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden">
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
            <span className="text-[10px] text-muted">~240 trials · est. 4 min</span>
          </div>
          {running && (
            <div className="w-full bg-dark-700 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-linear-to-r from-accent to-blue rounded-full transition-all duration-300" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
        <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Optimization Results</div>

        {/* Best Result Summary */}
        <div className="bg-linear-to-br from-[#22d3a510] to-[#0f4a3720] border border-accent/30 rounded-lg p-2.5 mb-2.5">
          <div className="text-[10px] text-accent font-semibold tracking-wider uppercase mb-1">🏆 Best Result</div>
          <div className="flex gap-3 text-[11px] font-['JetBrains_Mono']">
            <span className="text-text-dim">
              Sharpe: <span className="text-accent">2.11</span>
            </span>
            <span className="text-text-dim">
              Return: <span className="text-accent">+61%</span>
            </span>
            <span className="text-text-dim">
              DD: <span className="text-red">-9.8%</span>
            </span>
          </div>
        </div>

        <div className="flex gap-1.5 mb-2.5">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#22d3a518] text-accent border-accent-dim">240 trials</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#4e9eff18] text-blue border-[#0f2a4a]">Optuna TPE</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#a78bfa18] text-purple border-[#4a3a8a]">Best: Sharpe 2.11</span>
        </div>

        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">#</th>
              <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">fast</th>
              <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">slow</th>
              <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">rsi</th>
              <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">Sharpe</th>
              <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">Return</th>
              <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600">DD</th>
              <th className="text-[10px] text-muted tracking-wider uppercase py-1 px-2 text-left border-b border-dark-600"></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.rank} className={r.rank === 1 ? "bg-[#22d3a518]" : "hover:bg-dark-700 transition-colors"}>
                <td className="py-1.5 px-2 border-b border-dark-600">{rankBadge(r.rank)}</td>
                <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono']">{r.fast}</td>
                <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono']">{r.slow}</td>
                <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono']">{r.rsi}</td>
                <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-accent">{r.sharpe}</td>
                <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-accent">{r.ret}</td>
                <td className="py-1.5 px-2 border-b border-dark-600 font-['JetBrains_Mono'] text-red">{r.dd}</td>
                <td className="py-1.5 px-2 border-b border-dark-600">
                  <button className="text-[10px] font-medium px-2 py-0.5 rounded border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all">Deploy→</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
