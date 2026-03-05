import { useState, useMemo } from "react";
import useModels from "../hooks/useModels";
import useRace from "../hooks/useRace";
import ModelSelector from "../components/ModelSelector";
import InputPanel from "../components/InputPanel";
import RaceTrack from "../components/RaceTrack";
import ResultCard from "../components/ResultCard";
import ShareModal from "../components/ShareModal";
import AddModelModal from "../components/AddModelModal";
import PromptTemplateDrawer from "../components/PromptTemplateDrawer";

/**
 * Main race UI page — model selection, input panel, race track, results.
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
  const [shaking, setShaking] = useState(false);

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
    // Trigger screen shake
    setShaking(true);
    setTimeout(() => setShaking(false), 400);

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
    <div className={`flex flex-col gap-6 ${shaking ? "screen-shake" : ""}`}>
      {/* INSERT COIN when idle */}
      {status === "idle" && (
        <div className="text-center">
          <span className="insert-coin text-[10px] uppercase">
            Insert Coin to Race
          </span>
        </div>
      )}

      {/* Model Selector — player select style */}
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
            className="text-[8px] uppercase tracking-wider transition-colors"
            style={{
              color: m.color,
              textShadow: `0 0 4px ${m.color}`,
            }}
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

      {/* Race Track — Three.js canvas (responsive container) */}
      {(status === "running" || status === "done") && (
        <div className="flex flex-col gap-2 race-layout">
          <h2 className="text-[10px] text-gray-500 uppercase tracking-wider">
            Race Track
          </h2>
          <div className="race-track-container">
            <RaceTrack
              models={activeModels}
              modelStates={modelStates}
              raceStatus={status}
            />
          </div>
        </div>
      )}

      {/* Race Results — responsive grid */}
      {status === "done" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] text-gray-500 uppercase tracking-wider">
              Results
            </h2>
            <button
              onClick={handleNewRace}
              className="text-[8px] neon-cyan uppercase tracking-wider transition-colors hover:opacity-80"
            >
              New Race
            </button>
          </div>

          <div className="results-grid">
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

      {/* Running state — streaming text (responsive grid) */}
      {status === "running" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-[10px] text-gray-500 uppercase tracking-wider neon-flicker">
            Racing…
          </h2>
          <div className="results-grid">
            {activeModels.map((m) => {
              const state = modelStates[m.id];
              if (!state) return null;
              return (
                <div
                  key={m.id}
                  className="p-4 bg-[#0e0e24] border-2 overflow-hidden"
                  style={{
                    borderColor: state.status === "error" ? "#ef4444" : m.color,
                    boxShadow: state.status === "error"
                      ? "0 0 12px #ef444433"
                      : `0 0 12px ${m.color}33`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-block w-2 h-2"
                      style={{
                        backgroundColor: state.status === "error" ? "#ef4444" : m.color,
                      }}
                    />
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        state.status === "error" ? "error-flicker" : ""
                      }`}
                      style={{
                        color: state.status === "error" ? "#ef4444" : m.color,
                        textShadow: state.status === "error"
                          ? "0 0 6px #ef4444"
                          : `0 0 6px ${m.color}`,
                      }}
                    >
                      {m.label}
                    </span>
                    <span className="text-[8px] text-gray-500 uppercase">
                      {state.status === "running"
                        ? "Streaming…"
                        : state.status === "error"
                        ? "Crashed!"
                        : state.status}
                    </span>
                  </div>
                  <pre
                    className={`text-[10px] whitespace-pre-wrap break-words max-h-48 overflow-y-auto ${
                      state.status === "error" ? "text-[#ff3cac]" : "text-gray-300"
                    }`}
                  >
                    {state.text || (state.status === "error" ? "Error occurred" : "Waiting…")}
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
