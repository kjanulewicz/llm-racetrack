import { useState, useMemo } from "react";
import useModels from "../hooks/useModels";
import useRace from "../hooks/useRace";
import ModelSelector from "../components/ModelSelector";
import InputPanel from "../components/InputPanel";
import ResultCard from "../components/ResultCard";
import ShareModal from "../components/ShareModal";
import AddModelModal from "../components/AddModelModal";
import PromptTemplateDrawer from "../components/PromptTemplateDrawer";

/**
 * Main race UI page — model selection, input panel, race results.
 */
export default function RacePage() {
  const { models, refresh } = useModels();
  const { modelStates, raceId, status, startRace, reset } = useRace();

  // null means "use auto-selection", array means "user has explicitly chosen"
  const [userActiveIds, setUserActiveIds] = useState(null);
  const [prompts, setPrompts] = useState({});
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSlotId, setActiveSlotId] = useState(null);

  // Derive effective active IDs: auto-select first 2 until user interacts
  const activeIds = useMemo(() => {
    if (userActiveIds !== null) return userActiveIds;
    if (models.length >= 2) return models.slice(0, 2).map((m) => m.id);
    return models.map((m) => m.id);
  }, [userActiveIds, models]);

  function handleRemoveModel(id) {
    setUserActiveIds(activeIds.filter((x) => x !== id));
  }

  function handlePromptChange(id, value) {
    setPrompts((prev) => ({ ...prev, [id]: value }));
  }

  function handleAddClick() {
    setAddModalOpen(true);
  }

  function handleModelSaved() {
    refresh();
  }

  function handleStartRace(userInput) {
    const raceModels = activeIds.map((id) => ({
      model_config_id: id,
      system_prompt: prompts[id] || "",
    }));
    startRace(userInput, raceModels);
  }

  function handleNewRace() {
    reset();
  }

  function handleTemplateSelect(content) {
    if (activeSlotId) {
      setPrompts((prev) => ({ ...prev, [activeSlotId]: content }));
    }
  }

  const activeModels = models.filter((m) => activeIds.includes(m.id));

  return (
    <div className="flex flex-col gap-6">
      {/* Model Selector */}
      <ModelSelector
        models={models}
        activeIds={activeIds}
        prompts={prompts}
        onRemoveModel={handleRemoveModel}
        onPromptChange={handlePromptChange}
        onAddClick={handleAddClick}
      />

      {/* Template buttons per model */}
      <div className="flex flex-wrap gap-2">
        {activeModels.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setActiveSlotId(m.id);
              setDrawerOpen(true);
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Templates for {m.label} →
          </button>
        ))}
      </div>

      {/* Input Panel */}
      <InputPanel
        onStartRace={handleStartRace}
        activeModelCount={activeIds.length}
        disabled={status === "running"}
        raceStatus={status}
      />

      {/* Race Results */}
      {status === "done" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-gray-400 uppercase tracking-wide">
              Results
            </h2>
            <button
              onClick={handleNewRace}
              className="text-xs text-cyan-400 hover:text-cyan-300 uppercase tracking-wider transition-colors"
            >
              New Race
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeModels.map((m) => {
              const state = modelStates[m.id];
              if (!state) return null;
              return (
                <ResultCard
                  key={m.id}
                  modelLabel={m.label}
                  color={m.color}
                  state={state}
                  raceId={raceId}
                  onShare={() => setShareModalOpen(true)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Running state */}
      {status === "running" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide">
            Racing…
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeModels.map((m) => {
              const state = modelStates[m.id];
              if (!state) return null;
              return (
                <div
                  key={m.id}
                  className="p-4 bg-gray-800 border-2 rounded-lg"
                  style={{ borderColor: m.color }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: m.color }}
                    />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: m.color }}
                    >
                      {m.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {state.status === "running"
                        ? "Streaming…"
                        : state.status}
                    </span>
                  </div>
                  <pre className="text-sm text-gray-200 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                    {state.text || "Waiting…"}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {raceId && (
        <ShareModal
          open={shareModalOpen}
          raceId={raceId}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {/* Add Model Modal */}
      <AddModelModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSaved={handleModelSaved}
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
