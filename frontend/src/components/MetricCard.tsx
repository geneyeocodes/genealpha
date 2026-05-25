interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  color: "green" | "blue" | "red" | "amber" | "purple";
  sparklineData?: number[];
}

const colorMap = {
  green: { text: "text-[#22d3a5]", border: "border-[#22d3a5]/20", glow: "shadow-[0_0_12px_#22d3a520]", icon: "M13,7 L18,12 L13,17 M18,12 L6,12" },
  blue: { text: "text-[#4e9eff]", border: "border-[#4e9eff]/20", glow: "shadow-[0_0_12px_#4e9eff20]", icon: "M12,5 L12,19 M5,12 L19,12" },
  red: { text: "text-[#ff5a5a]", border: "border-[#ff5a5a]/20", glow: "shadow-[0_0_12px_#ff5a5a20]", icon: "M17,7 L7,17 M7,7 L17,17" },
  amber: { text: "text-[#f5a623]", border: "border-[#f5a623]/20", glow: "shadow-[0_0_12px_#f5a62320]", icon: "M12,9 L12,12 M12,15 L12,15.01 M21,12 C21,16.97 16.97,21 12,21 C7.03,21 3,16.97 3,12 C3,7.03 7.03,3 12,3 C16.97,3 21,7.03 21,12Z" },
  purple: { text: "text-[#a78bfa]", border: "border-[#a78bfa]/20", glow: "shadow-[0_0_12px_#a78bfa20]", icon: "M13,2 L3,14 H12 L11,22 L21,10 H12Z" },
};

const defaultSparkline = [40, 35, 50, 45, 55, 48, 60, 55, 65, 58, 70, 65];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 80,
    h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MetricCard({ label, value, sub, color }: MetricCardProps) {
  const c = colorMap[color];
  return (
    <div className={`relative bg-linear-to-br from-dark-800 to-dark-750 border ${c.border} rounded-xl p-3.5 hover:${c.glow} transition-all duration-300 group cursor-default overflow-hidden`}>
      {/* Top bar accent */}
      <div
        className={`absolute top-0 left-4 right-4 h-0.5 rounded-full bg-linear-to-r from-transparent via-${color === "green" ? "#22d3a5" : color === "blue" ? "#4e9eff" : color === "red" ? "#ff5a5a" : color === "amber" ? "#f5a623" : "#a78bfa"} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}
      />

      <div className="flex items-start justify-between mb-1">
        <div className="text-[10px] font-medium text-muted tracking-wider uppercase">{label}</div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.text.replace("text-[", "").replace("]", "")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 group-hover:opacity-80 transition-opacity">
          <path d={c.icon} />
        </svg>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className={`font-['JetBrains_Mono'] text-xl font-semibold ${c.text}`}>{value}</div>
          <div className="text-[10px] text-muted mt-0.5">{sub}</div>
        </div>
        <Sparkline data={defaultSparkline} color={c.text.replace("text-[", "").replace("]", "")} />
      </div>
    </div>
  );
}
