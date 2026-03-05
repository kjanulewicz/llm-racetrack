import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "./auth/msal.config";
import { useState } from "react";
import RacePage from "./pages/RacePage";
import HistoryPage from "./pages/HistoryPage";
import SharedPage from "./pages/SharedPage";
import SettingsPage from "./pages/SettingsPage";

const NAV_ITEMS = [
  { key: "race", label: "Race" },
  { key: "history", label: "History" },
  { key: "shared", label: "Shared" },
  { key: "settings", label: "Settings" },
];

function App() {
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <button
          onClick={() => instance.loginRedirect(loginRequest)}
          className="px-6 py-3 text-lg font-bold text-gray-900 bg-cyan-400 rounded hover:bg-cyan-300 transition-colors uppercase tracking-wider"
        >
          Sign in with Azure AD
        </button>
      </div>
    );
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [page, setPage] = useState("race");
  const { instance } = useMsal();

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-cyan-400 uppercase tracking-wider">
          LLM Racetrack
        </h1>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className={`px-3 py-1.5 text-xs uppercase tracking-wide rounded transition-colors ${
                page === item.key
                  ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400"
                  : "text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => instance.logoutRedirect()}
            className="ml-4 px-3 py-1.5 text-xs uppercase tracking-wide text-gray-500 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </nav>
      </header>

      <main>
        {page === "race" && <RacePage />}
        {page === "history" && <HistoryPage />}
        {page === "shared" && <SharedPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
