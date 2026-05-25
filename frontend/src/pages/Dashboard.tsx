import { useState, useEffect } from "react";
import type { Bot } from "../types";
import { apiGet } from "../api/client";
import MetricCard from "../components/MetricCard";
import BotTable from "../components/BotTable";

export default function Dashboard() {
  const [bots, setBots] = useState<Bot[]>([]);

  useEffect(() => {
    apiGet<Bot[]>("/bots")
      .then(setBots)
      .catch(() => {});
  }, []);

  const running = bots.filter((b) => b.status === "running").length;

  const handleStop = (id: string) => {
    console.log("Stop bot:", id);
  };

  const handleView = (id: string) => {
    console.log("View bot:", id);
  };

  const handleDeploy = (id: string) => {
    console.log("Deploy bot:", id);
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-semibold text-text">Dashboard</h1>
          <p className="text-[10px] text-muted mt-0.5">Overview of your trading bots and portfolio</p>
        </div>
        <div className="flex gap-1">
          <button className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-[#3a4570] bg-dark-700 text-text-dim hover:text-text transition-all">⟳ Refresh</button>
          <button className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all">+ New Bot</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <MetricCard label="Total P&L Today" value="+$1,847" sub="↑ 3 bots profitable" color="green" />
        <MetricCard label="Active Bots" value={`${running}`} sub={`${bots.length} total configured`} color="blue" />
        <MetricCard label="Open Positions" value="11" sub="Across 6 symbols" color="amber" />
        <MetricCard label="Drawdown" value="-2.1%" sub="Max allowed: 5%" color="red" />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold text-muted tracking-wider uppercase">Running Bots</span>
        <span className="text-[10px] text-dark-600 font-['JetBrains_Mono']">{bots.length} total</span>
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
        <BotTable bots={bots} onStop={handleStop} onView={handleView} onDeploy={handleDeploy} />
      </div>
    </div>
  );
}
