import { useState } from "react";

export default function Deploy() {
  const [deploying, setDeploying] = useState(false);

  const handleDeploy = () => {
    setDeploying(true);
    setTimeout(() => setDeploying(false), 2000);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {/* Bot Configuration */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Bot Configuration</div>

          <FieldGroup label="Bot Name" value="MomentumBot-EMA-v3" />
          <FieldGroup label="Symbol" value="AAPL" />
          <SelectGroup label="Account Mode" options={["Paper Trading", "Live Trading"]} />
          <SelectGroup label="Order Type" options={["Market", "Limit", "MOC"]} />
          <FieldGroup label="Max Position Size ($)" value="5000" />
          <FieldGroup label="Max Daily Loss ($)" value="200" />
        </div>

        {/* Strategy Parameters */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Strategy Parameters (optimized)</div>

          <FieldGroup label="fast_ema" value="12" />
          <FieldGroup label="slow_ema" value="45" />
          <FieldGroup label="rsi_period" value="16" />
          <FieldGroup label="rsi_entry_threshold" value="50" />
          <FieldGroup label="atr_multiplier" value="1.5" />
          <FieldGroup label="Schedule (cron)" value="0 9 * * 1-5" />
        </div>
      </div>

      {/* Deploy confirmation */}
      <div className="mt-3 bg-linear-to-br from-[#22d3a518] to-[#0f4a3720] border border-accent/40 rounded-xl p-3.5 flex items-center justify-between group hover:border-accent/60 transition-all">
        <div className="text-[11px] text-text-dim leading-relaxed">
          <strong className="text-text">MomentumBot-EMA-v3</strong> · AAPL · Paper · Market orders
          <br />
          Max position $5,000 · Daily stop $200 · Sharpe 2.11 in backtest
        </div>
        <button onClick={handleDeploy} disabled={deploying} className="group/btn relative text-xs font-medium px-6 py-2 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden">
          <span className="relative z-10 flex items-center gap-1.5">
            {deploying ? (
              <>
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                </svg>
                Deploying...
              </>
            ) : (
              "🚀 Deploy Bot ↗"
            )}
          </span>
          <span className="absolute inset-0 bg-linear-to-r from-transparent via-[#22d3a520] to-transparent translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
        </button>
      </div>
    </div>
  );
}

function FieldGroup({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 group">
      <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">{label}</div>
      <input defaultValue={value} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-2 font-['JetBrains_Mono'] text-xs text-text outline-none focus:border-blue focus:shadow-[0_0_8px_#4e9eff30] transition-all" type="text" />
    </div>
  );
}

function SelectGroup({ label, options }: { label: string; options: string[] }) {
  const [selected, setSelected] = useState(options[0]);
  return (
    <div className="mb-3 group">
      <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">{label}</div>
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 font-['JetBrains_Mono'] text-xs text-text outline-none appearance-none cursor-pointer focus:border-blue focus:shadow-[0_0_8px_#4e9eff30] transition-all"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
