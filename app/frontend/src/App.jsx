import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "./auth/msal.config";
import useModels from "./hooks/useModels";
import AddModelModal from "./components/AddModelModal";
import SystemPromptEditor from "./components/SystemPromptEditor";
import PromptTemplateDrawer from "./components/PromptTemplateDrawer";
import { useState } from "react";

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
  const { models, loading, refresh } = useModels();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prompts, setPrompts] = useState({});
  const [activeSlotId, setActiveSlotId] = useState(null);

  function handlePromptChange(modelId, value) {
    setPrompts((prev) => ({ ...prev, [modelId]: value }));
  }

  function handleTemplateSelect(content) {
    if (activeSlotId) {
      setPrompts((prev) => ({ ...prev, [activeSlotId]: content }));
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-cyan-400 uppercase tracking-wider">
          LLM Racetrack
        </h1>
      </header>

      {/* Model Slots */}
      <section className="mb-6">
        <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-3">
          Model Slots
        </h2>

        {loading && <p className="text-gray-500 text-sm">Loading models…</p>}

        <div className="flex flex-wrap gap-3">
          {models.map((m) => (
            <div
              key={m.id}
              className="px-4 py-2 bg-gray-800 border-2 rounded text-sm"
              style={{ borderColor: m.color }}
            >
              <span style={{ color: m.color }}>{m.label}</span>
            </div>
          ))}

          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 border-2 border-dashed border-gray-600 text-gray-400 rounded hover:border-cyan-400 hover:text-cyan-400 text-sm transition-colors"
          >
            + Add Model
          </button>
        </div>
      </section>

      {/* System Prompt Editors */}
      <section className="mb-6 flex flex-col gap-2">
        {models.map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <div className="flex-1">
              <SystemPromptEditor
                modelLabel={m.label}
                color={m.color}
                value={prompts[m.id] || ""}
                onChange={(v) => handlePromptChange(m.id, v)}
              />
            </div>
            <button
              onClick={() => {
                setActiveSlotId(m.id);
                setDrawerOpen(true);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 transition-colors whitespace-nowrap"
              title="Browse prompt templates"
            >
              Templates →
            </button>
          </div>
        ))}
      </section>

      {/* Add Model Modal */}
      <AddModelModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSaved={refresh}
      />

      {/* Prompt Template Drawer */}
      <PromptTemplateDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelect={handleTemplateSelect}
        currentPrompt={activeSlotId ? prompts[activeSlotId] || "" : ""}
      />
    </div>
  );
}

export default App;
