import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";

const LS_KEY = "llm-racetrack-model-settings";

/**
 * Reads model settings from localStorage.
 * @returns {{ visibility: Record<string, boolean>, prompts: Record<string, string> }}
 */
function readLocalSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupt data
  }
  return { visibility: {}, prompts: {} };
}

/**
 * Writes model settings to localStorage immediately.
 */
function writeLocalSettings(settings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch {
    // storage full or unavailable
  }
}

/**
 * Slide-out drawer for settings: shows all configured models,
 * toggle visibility in selector, edit system prompts.
 * Saves to localStorage immediately and syncs to /api/me/models.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   models: Array<{ id: string, label: string, provider: string, color: string, system_prompt?: string }>,
 *   onSettingsChange: (settings: { visibility: Record<string, boolean>, prompts: Record<string, string> }) => void
 * }} props
 */
export default function SettingsDrawer({ open, onClose, models, onSettingsChange }) {
  const [settings, setSettings] = useState(readLocalSettings);
  const [syncing, setSyncing] = useState(false);

  // Sync from server on mount
  useEffect(() => {
    if (!open) return;
    const local = readLocalSettings();
    setSettings(local);
  }, [open]);

  const persist = useCallback(
    (next) => {
      setSettings(next);
      writeLocalSettings(next);
      if (onSettingsChange) onSettingsChange(next);
    },
    [onSettingsChange]
  );

  function toggleVisibility(id) {
    const next = {
      ...settings,
      visibility: {
        ...settings.visibility,
        [id]: !settings.visibility[id],
      },
    };
    persist(next);
  }

  function updatePrompt(id, value) {
    const next = {
      ...settings,
      prompts: {
        ...settings.prompts,
        [id]: value,
      },
    };
    persist(next);
  }

  async function syncToServer() {
    setSyncing(true);
    try {
      await apiFetch("/api/me/models", {
        method: "PATCH",
        body: JSON.stringify({
          visibility: settings.visibility,
          prompts: settings.prompts,
        }),
      });
    } catch {
      // silent — localStorage is the source of truth
    } finally {
      setSyncing(false);
    }
  }

  // Auto-sync on close
  function handleClose() {
    syncToServer();
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`settings-drawer-backdrop ${open ? "open" : ""}`}
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div className={`settings-drawer ${open ? "open" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[#333366]">
          <h2 className="text-[10px] neon-cyan uppercase tracking-wider">
            Settings
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white text-sm leading-none"
          >
            ✕
          </button>
        </div>

        {/* Model list */}
        <div className="px-6 py-4 flex flex-col gap-3">
          <h3 className="text-[8px] text-gray-500 uppercase tracking-wider">
            Configured Models
          </h3>

          {models.length === 0 && (
            <p className="text-[10px] text-gray-600">No models configured.</p>
          )}

          {models.map((m) => {
            const visible = settings.visibility[m.id] !== false;
            const prompt = settings.prompts[m.id] ?? m.system_prompt ?? "";

            return (
              <div
                key={m.id}
                className="bg-[#0a0a1a] border-2 overflow-hidden"
                style={{
                  borderColor: visible ? m.color : "#333366",
                  boxShadow: visible
                    ? `0 0 8px ${m.color}44`
                    : "none",
                  opacity: visible ? 1 : 0.5,
                }}
              >
                {/* Row: toggle + label */}
                <div className="flex items-center gap-3 px-3 py-2">
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleVisibility(m.id)}
                      className="accent-[#3cf] shrink-0"
                    />
                    <span
                      className="inline-block w-2 h-2 shrink-0"
                      style={{ backgroundColor: m.color }}
                    />
                    <span
                      className="text-[10px] uppercase truncate"
                      style={{
                        color: visible ? m.color : "#666",
                        textShadow: visible ? `0 0 6px ${m.color}` : "none",
                      }}
                    >
                      {m.label}
                    </span>
                  </label>
                  <span className="text-[8px] text-gray-600 uppercase shrink-0">
                    {m.provider}
                  </span>
                </div>

                {/* System prompt editor */}
                {visible && (
                  <div className="px-3 pb-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[8px] text-gray-600 uppercase tracking-wider">
                        System Prompt
                      </span>
                      <textarea
                        value={prompt}
                        onChange={(e) => updatePrompt(m.id, e.target.value)}
                        rows={2}
                        placeholder="Enter system prompt…"
                        className="w-full bg-[#0e0e24] border-2 border-[#333366] text-white px-2 py-1 text-[10px] resize-y focus:border-[#3cf] focus:outline-none"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}

          {/* Sync status */}
          <div className="flex items-center justify-between pt-2 border-t border-[#333366]">
            <span className="text-[8px] text-gray-600 uppercase">
              Auto-saved to browser
            </span>
            <button
              onClick={syncToServer}
              disabled={syncing}
              className="text-[8px] neon-cyan uppercase tracking-wider hover:opacity-80 disabled:opacity-50 transition-colors"
            >
              {syncing ? "Syncing…" : "Sync to Cloud"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
