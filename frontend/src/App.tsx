import { useState, useEffect, useRef } from "react";
import type { PageTab, StrategyConfig } from "./types";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Idea from "./pages/Idea";
import Optimize from "./pages/Optimize";
import Deploy from "./pages/Deploy";

function App() {
  const [activeTab, setActiveTab] = useState<PageTab>("dashboard");
  const [wsStatus, setWsStatus] = useState<"connected" | "disconnected" | "connecting">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const [transitionKey, setTransitionKey] = useState(0);

  // Shared state: strategy config from Idea → Optimize
  const [optimizeConfig, setOptimizeConfig] = useState<StrategyConfig | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      setWsStatus("connecting");
      const wsBase = import.meta.env.VITE_WS_BASE || "ws://localhost:8000/api/v1";
      const ws = new WebSocket(`${wsBase}/ws/live`);
      wsRef.current = ws;

      ws.onopen = () => setWsStatus("connected");
      ws.onclose = () => {
        setWsStatus("disconnected");
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const handleTabChange = (tab: PageTab) => {
    setActiveTab(tab);
    setTransitionKey((k) => k + 1);
  };

  const handleOptimize = (config: StrategyConfig) => {
    setOptimizeConfig(config);
    setActiveTab("optimize");
    setTransitionKey((k) => k + 1);
  };

  const renderPage = () => {
    const className = "page-enter";
    switch (activeTab) {
      case "dashboard":
        return (
          <div key={transitionKey} className={className}>
            <Dashboard />
          </div>
        );
      case "idea":
        return (
          <div key={transitionKey} className={className}>
            <Idea onOptimize={handleOptimize} />
          </div>
        );
      case "optimize":
        return (
          <div key={transitionKey} className={className}>
            <Optimize strategyConfig={optimizeConfig} />
          </div>
        );
      case "deploy":
        return (
          <div key={transitionKey} className={className}>
            <Deploy />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen text-text flex flex-col">
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} wsStatus={wsStatus} />
      <main className="flex-1 p-4 sm:p-5">{renderPage()}</main>
      <footer className="text-center text-[10px] text-dark-600 font-['JetBrains_Mono'] pb-3 tracking-wider">GENEALPHA v0.1.0 · {new Date().getFullYear()}</footer>
    </div>
  );
}

export default App;
