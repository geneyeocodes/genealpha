import { useState, useEffect } from "react";
import type { Bot, PageTab } from "../types";
import { apiGet, apiPost } from "../api/client";
import MetricCard from "../components/MetricCard";
import BotTable from "../components/BotTable";

interface DashboardProps {
  onNavigate: (tab: PageTab, botId?: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formSymbol, setFormSymbol] = useState("SPY");

  const fetchBots = () => {
    apiGet<Bot[]>("/bots")
      .then(setBots)
      .catch(() => {});
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const running = bots.filter((b) => b.status === "running").length;

  const handleStop = async (id: string) => {
    try {
      await apiPost(`/bots/${id}/stop`);
      fetchBots();
    } catch (e) {
      console.error("Stop failed:", e);
    }
  };

  const handleView = (id: string) => onNavigate("deploy", id);
  const handleDeploy = (id: string) => onNavigate("deploy", id);

  const handleCreateBot = async () => {
    if (!formName.trim() || !formSymbol.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const bot = await apiPost<Bot>("/bots/", {
        name: formName.trim(),
        symbol: formSymbol.trim().toUpperCase(),
        strategy_config: {
          name: formName.trim(),
          entry_conditions: [],
          exit_conditions: [],
          position_sizing: { method: "percent", value: 100 },
          stop_loss: { method: "trailing_stop", params: { percent: 5 } },
          timeframe: "1d",
        },
        account_mode: "paper",
        order_type: "market",
        max_position_size: 5000,
        max_daily_loss: 200,
        schedule_cron: "0 9 * * 1-5",
      });
      setShowCreateForm(false);
      setFormName("");
      setFormSymbol("SPY");
      onNavigate("deploy", bot.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create bot");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-semibold text-text">Dashboard</h1>
          <p className="text-[10px] text-muted mt-0.5">Overview of your trading bots and portfolio</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowCreateForm(true)} className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all">
            + Create Bot
          </button>
          <button onClick={fetchBots} className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-[#3a4570] bg-dark-700 text-text-dim hover:text-text transition-all">
            ⟳ Refresh
          </button>
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

      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateForm(false)}>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 w-full max-w-sm mx-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-text tracking-wider uppercase">Create Bot</span>
              <button onClick={() => setShowCreateForm(false)} className="text-muted hover:text-text transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="space-y-2.5 mb-3">
              <div>
                <label className="text-[10px] font-medium text-muted tracking-wider uppercase block mb-1">Bot Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="My Trading Bot" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-blue" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted tracking-wider uppercase block mb-1">Symbol</label>
                <input type="text" value={formSymbol} onChange={(e) => setFormSymbol(e.target.value.toUpperCase())} placeholder="SPY" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-blue" />
              </div>
            </div>
            {createError && <div className="text-[10px] text-red mb-2">{createError}</div>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreateForm(false)} className="text-[10px] font-medium px-3 py-1.5 rounded-lg border border-[#3a4570] bg-dark-700 text-text-dim hover:text-text transition-all">
                Cancel
              </button>
              <button onClick={handleCreateBot} disabled={creating || !formName.trim() || !formSymbol.trim()} className="text-[10px] font-medium px-3 py-1.5 rounded-lg border border-accent bg-[#22d3a518] text-accent hover:bg-accent-dim transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? "Creating..." : "Create & Deploy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
