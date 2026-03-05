import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";
import useModels from "../hooks/useModels";
import usePromptTemplates from "../hooks/usePromptTemplates";
import SettingsDrawer from "../components/SettingsDrawer";

const TABS = [
  { key: "models", label: "My Models" },
  { key: "templates", label: "Prompt Templates" },
  { key: "preferences", label: "Preferences" },
];

/**
 * Settings page with three tabs and a slide-out drawer for quick model config.
 * - My Models: list + delete saved model configs via DELETE /api/me/models/{id}
 * - Prompt Templates: list + delete
 * - Preferences: default model selection saved via PATCH /api/me/preferences
 */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("models");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { models, refresh } = useModels();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm neon-cyan neon-flicker uppercase tracking-wider">
          Settings
        </h2>
        <button
          onClick={() => setDrawerOpen(true)}
          className="px-3 py-1.5 text-[8px] uppercase tracking-wider pixel-border-cyan text-[#3cf] hover:bg-[#3cf] hover:text-[#0a0a1a] transition-colors"
        >
          Quick Config ⚙
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b-2 border-[#333366]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-[10px] uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === tab.key
                ? "border-[#3cf] text-[#3cf]"
                : "border-transparent text-gray-600 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "models" && <ModelsTab />}
      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "preferences" && <PreferencesTab />}

      {/* Settings drawer (slide-out panel) */}
      <SettingsDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          refresh();
        }}
        models={models}
        onSettingsChange={() => {}}
      />
    </div>
  );
}

function ModelsTab() {
  const { userModels, loading, refresh } = useModels();
  const [deleting, setDeleting] = useState(null);

  async function handleDelete(id) {
    setDeleting(id);
    try {
      const res = await apiFetch(`/api/me/models/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        refresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <p className="text-[10px] text-gray-600">Loading models…</p>;
  }

  if (userModels.length === 0) {
    return <p className="text-[10px] text-gray-600">No saved models.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {userModels.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between p-3 bg-[#0e0e24] border-2 border-[#333366]"
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-block w-3 h-3"
              style={{ backgroundColor: m.color }}
            />
            <div>
              <p className="text-[10px] text-white uppercase">{m.label}</p>
              <p className="text-[8px] text-gray-600">{m.provider}</p>
            </div>
          </div>
          <button
            onClick={() => handleDelete(m.id)}
            disabled={deleting === m.id}
            className="text-[8px] text-[#ff3cac] hover:opacity-80 disabled:opacity-50 transition-colors uppercase"
          >
            {deleting === m.id ? "Deleting…" : "Delete"}
          </button>
        </div>
      ))}
    </div>
  );
}

function TemplatesTab() {
  const { templates, loading, refresh } = usePromptTemplates();
  const [deleting, setDeleting] = useState(null);

  async function handleDelete(id) {
    setDeleting(id);
    try {
      const res = await apiFetch(`/api/me/prompts/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        refresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <p className="text-[10px] text-gray-600">Loading templates…</p>;
  }

  if (templates.length === 0) {
    return <p className="text-[10px] text-gray-600">No saved templates.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between p-3 bg-[#0e0e24] border-2 border-[#333366]"
        >
          <div>
            <p className="text-[10px] text-white uppercase">{t.name}</p>
            <p className="text-[8px] text-gray-600 truncate max-w-md">
              {t.content}
            </p>
          </div>
          <button
            onClick={() => handleDelete(t.id)}
            disabled={deleting === t.id}
            className="text-[8px] text-[#ff3cac] hover:opacity-80 disabled:opacity-50 transition-colors uppercase"
          >
            {deleting === t.id ? "Deleting…" : "Delete"}
          </button>
        </div>
      ))}
    </div>
  );
}

function PreferencesTab() {
  const { models } = useModels();
  const [defaults, setDefaults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Fetch current preferences on mount
  const fetchPreferences = useCallback(async () => {
    try {
      const res = await apiFetch("/api/me/preferences");
      if (res.ok) {
        const data = await res.json();
        setDefaults(data.default_model_ids || []);
      }
    } catch {
      // Ignore — user may not have preferences yet
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  function toggleModel(id) {
    setDefaults((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await apiFetch("/api/me/preferences", {
        method: "PATCH",
        body: JSON.stringify({ default_model_ids: defaults }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Save failed (${res.status})`);
      }
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
          Default Model Selection
        </h3>
        <p className="text-[8px] text-gray-600 mb-3">
          Select which models should be pre-selected when starting a new race.
        </p>

        <div className="flex flex-col gap-2">
          {models.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-3 p-2 bg-[#0e0e24] cursor-pointer hover:bg-[#12123a] border-2 border-[#333366]"
            >
              <input
                type="checkbox"
                checked={defaults.includes(m.id)}
                onChange={() => toggleModel(m.id)}
                className="accent-[#3cf]"
              />
              <span
                className="inline-block w-2 h-2"
                style={{ backgroundColor: m.color }}
              />
              <span className="text-[10px] text-white uppercase">
                {m.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-[10px] text-[#ff3cac]">{error}</p>}
      {saved && (
        <p className="text-[10px] neon-green">Preferences saved!</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="self-start px-4 py-2 text-[10px] font-bold bg-[#0a0a1a] text-[#3cf] pixel-border-cyan uppercase tracking-wider hover:bg-[#3cf] hover:text-[#0a0a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? "Saving…" : "Save Preferences"}
      </button>
    </div>
  );
}
