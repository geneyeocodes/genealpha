import type { Bot } from "../types";

interface BotTableProps {
  bots: Bot[];
  onStop: (id: string) => void;
  onView: (id: string) => void;
  onDeploy: (id: string) => void;
}

const statusBadge: Record<string, { class: string; label: string }> = {
  running: { class: "bg-[#22d3a518] text-accent border-accent-dim", label: "Running" },
  stopped: { class: "bg-[#ff5a5a18] text-red border-[#4a0f0f]", label: "Stopped" },
  optimizing: { class: "bg-[#f5a62318] text-[#f5a623] border-[#3a2a0f]", label: "Optimizing" },
  backtesting: { class: "bg-[#4e9eff18] text-[#4e9eff] border-[#0f2a4a]", label: "Backtesting" },
  error: { class: "bg-[#ff5a5a18] text-red border-[#4a0f0f]", label: "Error" },
};

export default function BotTable({ bots, onStop, onView, onDeploy }: BotTableProps) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th className="text-[10px] font-medium text-muted tracking-wider uppercase py-1.5 px-2.5 text-left border-b border-dark-600">Bot Name</th>
          <th className="text-[10px] font-medium text-muted tracking-wider uppercase py-1.5 px-2.5 text-left border-b border-dark-600">Strategy</th>
          <th className="text-[10px] font-medium text-muted tracking-wider uppercase py-1.5 px-2.5 text-left border-b border-dark-600">Symbol</th>
          <th className="text-[10px] font-medium text-muted tracking-wider uppercase py-1.5 px-2.5 text-left border-b border-dark-600">Status</th>
          <th className="text-[10px] font-medium text-muted tracking-wider uppercase py-1.5 px-2.5 text-left border-b border-dark-600">Return</th>
          <th className="text-[10px] font-medium text-muted tracking-wider uppercase py-1.5 px-2.5 text-left border-b border-dark-600">Sharpe</th>
          <th className="text-[10px] font-medium text-muted tracking-wider uppercase py-1.5 px-2.5 text-left border-b border-dark-600">Drawdown</th>
          <th className="text-[10px] font-medium text-muted tracking-wider uppercase py-1.5 px-2.5 text-left border-b border-dark-600">Actions</th>
        </tr>
      </thead>
      <tbody>
        {bots.map((bot, index) => {
          const badge = statusBadge[bot.status] || statusBadge.stopped;
          const isRunning = bot.status === "running";
          return (
            <tr key={bot.id} className={`group hover:bg-dark-700 transition-colors duration-150 ${isRunning ? "bg-[#22d3a508]" : ""}`} style={{ animation: `fade-in-up 0.35s ease-out ${index * 0.04}s both` }}>
              <td className="py-2 px-2.5 border-b border-dark-600 relative">
                {isRunning && <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent rounded-full shadow-[0_0_4px_#22d3a5]" />}
                <span className="font-['JetBrains_Mono'] text-text font-medium ml-1">{bot.name}</span>
              </td>
              <td className="py-2 px-2.5 border-b border-dark-600 font-['JetBrains_Mono'] text-text-dim">{(bot.strategy_config as any)?.name || bot.name}</td>
              <td className="py-2 px-2.5 border-b border-dark-600 font-['JetBrains_Mono']">{bot.symbol}</td>
              <td className="py-2 px-2.5 border-b border-dark-600">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.class}`}>
                  <span className={`w-1.5 h-1.5 rounded-full bg-current ${isRunning ? "animate-breathe" : ""}`} />
                  {badge.label}
                </span>
              </td>
              <td className="py-2 px-2.5 border-b border-dark-600 font-['JetBrains_Mono'] text-accent">--</td>
              <td className="py-2 px-2.5 border-b border-dark-600 font-['JetBrains_Mono']">--</td>
              <td className="py-2 px-2.5 border-b border-dark-600 font-['JetBrains_Mono'] text-red">--</td>
              <td className="py-2 px-2.5 border-b border-dark-600">
                {bot.status === "running" && (
                  <button onClick={() => onStop(bot.id)} className="text-[10px] font-medium px-2 py-0.5 rounded border border-[#3a4570] bg-dark-700 text-text-dim hover:border-red hover:text-red hover:bg-[#ff5a5a10] transition-all">
                    Stop
                  </button>
                )}
                {(bot.status === "stopped" || bot.status === "error") && (
                  <button onClick={() => onDeploy(bot.id)} className="text-[10px] font-medium px-2 py-0.5 rounded border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all">
                    Deploy
                  </button>
                )}
                {bot.status !== "running" && bot.status !== "stopped" && bot.status !== "error" && (
                  <button onClick={() => onView(bot.id)} className="text-[10px] font-medium px-2 py-0.5 rounded border border-[#3a4570] bg-dark-700 text-text-dim hover:border-text hover:text-text transition-all">
                    View
                  </button>
                )}
              </td>
            </tr>
          );
        })}
        {bots.length === 0 && (
          <tr>
            <td colSpan={8} className="py-10 text-center">
              <div className="flex flex-col items-center gap-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2a3050" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                </svg>
                <span className="text-muted text-xs">
                  No bots yet. Create one from the <span className="text-blue">Idea</span> tab.
                </span>
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
