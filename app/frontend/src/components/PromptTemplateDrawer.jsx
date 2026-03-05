import { useState } from "react";
import usePromptTemplates from "../hooks/usePromptTemplates";

/**
 * Slide-out drawer listing saved prompt templates.
 * Clicking a template inserts its content into the active slot's prompt.
 * Also provides a button to save the current prompt as a new template.
 *
 * @param {{ open: boolean, onClose: () => void, onSelect: (content: string) => void, currentPrompt: string }} props
 */
export default function PromptTemplateDrawer({
  open,
  onClose,
  onSelect,
  currentPrompt,
}) {
  const { templates, loading, saveTemplate } = usePromptTemplates();
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  async function handleSaveAsTemplate() {
    if (!newName.trim() || !currentPrompt.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveTemplate(newName.trim(), currentPrompt);
      setNewName("");
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-80 bg-gray-900 border-l-2 border-cyan-400 shadow-lg shadow-cyan-400/20 transform transition-transform duration-200 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
          Prompt Templates
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col h-full overflow-y-auto p-4 gap-3">
        {/* Template List */}
        {loading && (
          <p className="text-gray-500 text-xs">Loading templates…</p>
        )}

        {!loading && templates.length === 0 && (
          <p className="text-gray-500 text-xs">No saved templates yet.</p>
        )}

        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onSelect(t.content);
              onClose();
            }}
            className="text-left p-3 bg-gray-800 border border-gray-700 rounded hover:border-cyan-400 transition-colors"
          >
            <p className="text-sm text-white font-medium">{t.name}</p>
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
              {t.content}
            </p>
          </button>
        ))}

        {/* Save Current Prompt */}
        {currentPrompt && (
          <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col gap-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Save current prompt as template
            </p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name"
              className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-sm focus:border-cyan-400 focus:outline-none"
            />
            <button
              onClick={handleSaveAsTemplate}
              disabled={saving || !newName.trim()}
              className="px-3 py-2 text-sm text-gray-900 bg-cyan-400 rounded font-semibold hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Save Template"}
            </button>
            {saveError && (
              <p className="text-red-400 text-xs">{saveError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
