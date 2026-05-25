import type { PageTab } from "../types";

interface NavbarProps {
  activeTab: PageTab;
  onTabChange: (tab: PageTab) => void;
  wsStatus: "connected" | "disconnected" | "connecting";
}

const tabs: { id: PageTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "idea", label: "Idea" },
  { id: "optimize", label: "Optimize" },
  { id: "deploy", label: "Deploy" },
];

const statusColors = {
  connected: "bg-accent",
  disconnected: "bg-[#ff5a5a]",
  connecting: "bg-[#f5a623]",
};

const statusLabels = {
  connected: "LIVE",
  disconnected: "OFFLINE",
  connecting: "SYNC",
};

export default function Navbar({ activeTab, onTabChange, wsStatus }: NavbarProps) {
  return (
    <nav className="flex items-center border-b border-dark-600 bg-dark-800/80 backdrop-blur-md px-4 sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2 py-3 pr-4 border-r border-dark-600 mr-2">
        <svg width="22" height="22" viewBox="0 0 32 32" className="shrink-0">
          <defs>
            <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3a5" />
              <stop offset="100%" stopColor="#4e9eff" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="none" stroke="url(#lg)" strokeWidth="2.5" />
          <polygon points="16,6 24,10 24,22 16,26 8,22 8,10" fill="url(#lg)" opacity="0.15" />
          <text x="16" y="20" textAnchor="middle" fill="#22d3a5" fontFamily="monospace" fontSize="11" fontWeight="bold" filter="url(#glow)">
            G
          </text>
        </svg>
        <span className="font-['JetBrains_Mono'] text-xs font-semibold text-accent tracking-[0.15em] drop-shadow-[0_0_6px_#22d3a560]">GENEALPHA</span>
      </div>

      {/* Tabs */}
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)} className={`relative text-xs font-medium px-3.5 py-3 whitespace-nowrap transition-all duration-200 ${activeTab === tab.id ? "text-accent" : "text-text-dim hover:text-text"}`}>
          {tab.label}
          {activeTab === tab.id && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-accent rounded-full shadow-[0_0_6px_#22d3a5]" />}
        </button>
      ))}

      {/* Connection Status */}
      <div className="ml-auto flex items-center gap-2 text-[11px] text-muted font-['JetBrains_Mono']" title={`IBKR ${wsStatus}`}>
        <span className={`relative flex items-center justify-center w-2 h-2`}>
          <span className={`absolute inset-0 rounded-full ${statusColors[wsStatus]} animate-breathe opacity-40`} />
          <span className={`w-1.5 h-1.5 rounded-full ${statusColors[wsStatus]}`} />
        </span>
        <span className="hidden sm:inline">{statusLabels[wsStatus]}</span>
        <span className="text-dark-600 hidden sm:inline">·</span>
        <span className="hidden sm:inline">PAPER</span>
      </div>
    </nav>
  );
}
