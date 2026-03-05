import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";
import useModels from "../hooks/useModels";
import usePromptTemplates from "../hooks/usePromptTemplates";

const TABS = [
  { key: "models", label: "My Models" },
  { key: "templates", label: "Prompt Templates" },
  { key: "preferences", label: "Preferences" },
];

/**
 * Settings page with three tabs:
 * - My Models: list + delete saved model configs via DELETE /api/me/models/{id}
 * - Prompt Templates: list + delete
 * - Preferences: default model selection saved via PATCH /api/me/preferences
 */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("models");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
        Settings
      </h2>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm uppercase tracking-wide transition-colors border-b-2 ${
              activeTab === tab.key
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "models" && <ModelsTab />}
      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "preferences" && <PreferencesTab />}
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
    return <p className="text-gray-500 text-sm">Loading models…</p>;
  }

  if (userModels.length === 0) {
    return <p className="text-gray-500 text-sm">No saved models.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {userModels.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: m.color }}
            />
            <div>
              <p className="text-sm text-white font-medium">{m.label}</p>
              <p className="text-xs text-gray-400">{m.provider}</p>
            </div>
          </div>
          <button
            onClick={() => handleDelete(m.id)}
            disabled={deleting === m.id}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
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
    return <p className="text-gray-500 text-sm">Loading templates…</p>;
  }

  if (templates.length === 0) {
    return <p className="text-gray-500 text-sm">No saved templates.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg"
        >
          <div>
            <p className="text-sm text-white font-medium">{t.name}</p>
            <p className="text-xs text-gray-400 truncate max-w-md">
              {t.content}
            </p>
          </div>
          <button
            onClick={() => handleDelete(t.id)}
            disabled={deleting === t.id}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
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
        <h3 className="text-sm text-gray-400 uppercase tracking-wide mb-2">
          Default Model Selection
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Select which models should be pre-selected when starting a new race.
        </p>

        <div className="flex flex-col gap-2">
          {models.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-3 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-750"
            >
              <input
                type="checkbox"
                checked={defaults.includes(m.id)}
                onChange={() => toggleModel(m.id)}
                className="accent-cyan-400"
              />
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              <span className="text-sm text-white">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {saved && (
        <p className="text-green-400 text-sm">Preferences saved!</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="self-start px-4 py-2 text-sm text-gray-900 bg-cyan-400 rounded font-semibold hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? "Saving…" : "Save Preferences"}
      </button>
    </div>
  );
}
