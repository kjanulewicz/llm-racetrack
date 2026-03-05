import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "./auth/msal.config";
import { useState } from "react";
import RacePage from "./pages/RacePage";
import HistoryPage from "./pages/HistoryPage";
import SharedPage from "./pages/SharedPage";
import SettingsPage from "./pages/SettingsPage";
import SettingsDrawer from "./components/SettingsDrawer";
import useModels from "./hooks/useModels";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

const NAV_ITEMS = [
  { key: "race", label: "Race" },
  { key: "history", label: "History" },
  { key: "shared", label: "Shared" },
  { key: "settings", label: "Settings" },
];

function App() {
  if (DEV_MODE) {
    return <AppShell userName="Local Developer" onLogout={null} />;
  }

  return <MsalGatedApp />;
}

/**
 * Standard MSAL-gated entry — shown only when DEV_MODE is off.
 */
function MsalGatedApp() {
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a1a] gap-8">
        <h1 className="text-2xl neon-cyan neon-flicker uppercase">
          LLM Racetrack
        </h1>
        <button
          onClick={() => instance.loginRedirect(loginRequest)}
          className="px-6 py-3 text-xs font-bold bg-[#0a0a1a] pixel-border-cyan text-[#3cf] uppercase tracking-wider hover:bg-[#3cf] hover:text-[#0a0a1a] transition-colors"
        >
          Sign in with Azure AD
        </button>
        <span className="insert-coin text-[10px] uppercase">
          Insert Coin
        </span>
      </div>
    );
  }

  return <MsalAuthenticatedApp />;
}

function MsalAuthenticatedApp() {
  const { instance, accounts } = useMsal();
  const userName = accounts?.[0]?.name || accounts?.[0]?.username || "";

  return (
    <AppShell userName={userName} onLogout={() => instance.logoutRedirect()} />
  );
}

function AppShell({ userName, onLogout }) {
  const [page, setPage] = useState("race");
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const { models, refresh: refreshModels } = useModels();

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between mb-6 pb-3 border-b-2 border-[#333366] gap-2">
        <h1 className="text-lg md:text-xl neon-cyan neon-flicker uppercase tracking-wider">
          LLM-Racetrack
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <nav className="flex items-center gap-1 flex-wrap">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`px-2 md:px-3 py-1.5 text-[8px] md:text-[10px] uppercase tracking-wide transition-colors ${
                  page === item.key
                    ? "pixel-border-cyan text-[#3cf]"
                    : "text-gray-500 hover:text-[#3cf] border-2 border-transparent"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => setSettingsDrawerOpen(true)}
              className="px-2 md:px-3 py-1.5 text-[8px] md:text-[10px] uppercase tracking-wide text-gray-500 hover:text-[#ffee00] border-2 border-transparent transition-colors"
              title="Quick Settings"
            >
              ⚙
            </button>
          </nav>
          {userName && (
            <span className="text-[8px] text-gray-500 uppercase hidden md:inline">
              {userName}
            </span>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-2 py-1.5 text-[8px] uppercase tracking-wide text-gray-600 hover:text-[#ff3cac] transition-colors pixel-border-pink"
              style={{ borderColor: "transparent", boxShadow: "none" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#ff3cac";
                e.currentTarget.style.boxShadow =
                  "0 0 12px #ff3cac, inset 0 0 8px rgba(0,0,0,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* INSERT COIN blink when on race page and idle */}
      <main>
        {page === "race" && <RacePage />}
        {page === "history" && <HistoryPage />}
        {page === "shared" && <SharedPage />}
        {page === "settings" && <SettingsPage />}
      </main>

      {/* Global settings drawer */}
      <SettingsDrawer
        open={settingsDrawerOpen}
        onClose={() => {
          setSettingsDrawerOpen(false);
          refreshModels();
        }}
        models={models}
        onSettingsChange={() => {}}
      />
    </div>
  );
}

export default App;
