import { useState, useEffect } from "react";
import type { Bot, StrategyConfig } from "../types";
import { apiGet, apiPost } from "../api/client";

interface DeployProps {
  botId: string | null;
}

export default function Deploy({ botId }: DeployProps) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strategyConfig: StrategyConfig | null = bot ? (bot.strategy_config as unknown as StrategyConfig) : null;

  useEffect(() => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    apiGet<Bot>(`/bots/${botId}`)
      .then(setBot)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [botId]);

  const handleDeploy = async () => {
    if (!bot) return;
    setDeploying(true);
    setError(null);
    try {
      await apiPost(`/bots/${bot.id}/start`);
      const updated = await apiGet<Bot>(`/bots/${bot.id}`);
      setBot(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const handleStop = async () => {
    if (!bot) return;
    setDeploying(true);
    setError(null);
    try {
      await apiPost(`/bots/${bot.id}/stop`);
      const updated = await apiGet<Bot>(`/bots/${bot.id}`);
      setBot(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stop failed");
    } finally {
      setDeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-muted">
        <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
        </svg>
        Loading bot...
      </div>
    );
  }

  if (error && !bot) {
    return <div className="text-center py-12 text-red">Failed to load bot: {error}</div>;
  }

  if (!bot) {
    return <div className="text-center py-12 text-muted">No bot selected. Choose a bot from the Dashboard.</div>;
  }

  const isRunning = bot.status === "running";
  const params = strategyConfig ? flattenStrategyParams(strategyConfig) : [];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {/* Bot Configuration */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Bot Configuration</div>
          <FieldGroup label="Bot Name" value={bot.name} />
          <FieldGroup label="Symbol" value={bot.symbol} />
          <SelectGroup label="Account Mode" value={bot.account_mode} options={["paper", "live"]} />
          <SelectGroup label="Order Type" value={bot.order_type} options={["market", "limit", "moc"]} />
          <FieldGroup label="Max Position Size ($)" value={String(bot.max_position_size)} />
          <FieldGroup label="Max Daily Loss ($)" value={String(bot.max_daily_loss)} />
          <FieldGroup label="Schedule (cron)" value={bot.schedule_cron} />
          <StatusBadge status={bot.status} />
        </div>

        {/* Strategy Parameters */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2.5">Strategy Parameters</div>
          {params.length > 0 ? (
            params.map((p, i) => <FieldGroup key={i} label={p.label} value={p.value} />)
          ) : (
            <div className="text-[11px] text-text-dim">
              <pre className="bg-dark-700 rounded-lg p-2.5 overflow-x-auto text-[10px]">{JSON.stringify(bot.strategy_config, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Deploy confirmation */}
      <div className="mt-3 bg-linear-to-br from-[#22d3a518] to-[#0f4a3720] border border-accent/40 rounded-xl p-3.5 flex items-center justify-between group hover:border-accent/60 transition-all">
        <div className="text-[11px] text-text-dim leading-relaxed">
          <strong className="text-text">{bot.name}</strong> · {bot.symbol} · {bot.account_mode === "paper" ? "Paper" : "Live"} · {bot.order_type} orders
          <br />
          Max position ${bot.max_position_size} · Daily stop ${bot.max_daily_loss}
        </div>
        <div className="flex gap-2">
          {isRunning ? (
            <button onClick={handleStop} disabled={deploying} className="group/btn relative text-xs font-medium px-6 py-2 rounded-lg border border-red bg-[#ff5a5a18] text-red hover:bg-[#ff5a5a30] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden">
              <span className="relative z-10 flex items-center gap-1.5">
                {deploying ? (
                  <>
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                    Stopping...
                  </>
                ) : (
                  "⏹ Stop Bot"
                )}
              </span>
            </button>
          ) : (
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
          )}
        </div>
      </div>
      {error && <div className="mt-2 text-[10px] text-red">{error}</div>}
    </div>
  );
}

function FieldGroup({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 group">
      <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">{label}</div>
      <input defaultValue={value} readOnly className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-2 font-['JetBrains_Mono'] text-xs text-text outline-none transition-all cursor-default" type="text" />
    </div>
  );
}

function SelectGroup({ label, value, options }: { label: string; value: string; options: string[] }) {
  return (
    <div className="mb-3 group">
      <div className="text-[10px] font-medium text-muted tracking-wider uppercase mb-1">{label}</div>
      <div className="relative">
        <select value={value} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 font-['JetBrains_Mono'] text-xs text-text outline-none appearance-none cursor-pointer focus:border-blue focus:shadow-[0_0_8px_#4e9eff30] transition-all">
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "bg-[#22d3a518] text-accent border-accent-dim",
    stopped: "bg-[#ff5a5a18] text-red border-[#4a0f0f]",
    error: "bg-[#ff5a5a18] text-red border-[#4a0f0f]",
    optimizing: "bg-[#f5a62318] text-[#f5a623] border-[#3a2a0f]",
    backtesting: "bg-[#4e9eff18] text-blue border-[#1a2a4a]",
  };
  const cls = colors[status] || colors.stopped;
  return (
    <div className="mt-2">
      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded border ${cls}`}>{status.toUpperCase()}</span>
    </div>
  );
}

function flattenStrategyParams(config: StrategyConfig): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = [];
  config.entry_conditions?.forEach((c, i) => {
    if (c.type === "crossover" && c.indicator && c.crosses_above) {
      result.push({ label: `Entry ${i + 1}: ${c.indicator.name.toUpperCase()}(${c.indicator.params?.period ?? 14}) cross above ${c.crosses_above.name.toUpperCase()}(${c.crosses_above.params?.period ?? 50})`, value: "crossover" });
    } else if (c.type === "comparison" && c.indicator) {
      result.push({ label: `Entry ${i + 1}: ${c.indicator.name.toUpperCase()}(${c.indicator.params?.period ?? 14}) ${c.operator} ${c.value}`, value: "comparison" });
    }
  });
  config.exit_conditions?.forEach((c, i) => {
    if (c.type === "crossunder" && c.indicator && c.crosses_below) {
      result.push({ label: `Exit ${i + 1}: ${c.indicator.name.toUpperCase()}(${c.indicator.params?.period ?? 14}) cross below ${c.crosses_below.name.toUpperCase()}(${c.crosses_below.params?.period ?? 50})`, value: "crossunder" });
    } else if (c.type === "comparison" && c.indicator) {
      result.push({ label: `Exit ${i + 1}: ${c.indicator.name.toUpperCase()}(${c.indicator.params?.period ?? 14}) ${c.operator} ${c.value}`, value: "comparison" });
    }
  });
  result.push({ label: "Position Sizing", value: `${config.position_sizing?.value ?? "?"}% ${config.position_sizing?.method ?? "?"}` });
  const sl = config.stop_loss;
  result.push({ label: "Stop Loss", value: `${sl?.method ?? "?"} ${JSON.stringify(sl?.params ?? {})}` });
  if (config.take_profit) result.push({ label: "Take Profit", value: `${config.take_profit.method} ${JSON.stringify(config.take_profit.params)}` });
  result.push({ label: "Timeframe", value: config.timeframe ?? "1d" });
  return result;
}
