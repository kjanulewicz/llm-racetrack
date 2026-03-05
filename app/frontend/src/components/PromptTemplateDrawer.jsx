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
      className={`fixed inset-y-0 right-0 z-50 w-80 bg-[#0e0e24] border-l-2 border-[#3cf] transform transition-transform duration-200 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ boxShadow: open ? "0 0 20px rgba(51,204,255,0.3)" : "none" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#333366]">
        <h3 className="text-[10px] neon-cyan uppercase tracking-wider">
          Prompt Templates
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-sm leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col h-full overflow-y-auto p-4 gap-3">
        {/* Template List */}
        {loading && (
          <p className="text-gray-600 text-[8px]">Loading templates…</p>
        )}

        {!loading && templates.length === 0 && (
          <p className="text-gray-600 text-[8px]">No saved templates yet.</p>
        )}

        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onSelect(t.content);
              onClose();
            }}
            className="text-left p-3 bg-[#0a0a1a] border-2 border-[#333366] hover:border-[#3cf] transition-colors"
          >
            <p className="text-[10px] text-white uppercase">{t.name}</p>
            <p className="text-[8px] text-gray-500 mt-1 line-clamp-2">
              {t.content}
            </p>
          </button>
        ))}

        {/* Save Current Prompt */}
        {currentPrompt && (
          <div className="mt-4 pt-4 border-t-2 border-[#333366] flex flex-col gap-2">
            <p className="text-[8px] text-gray-500 uppercase tracking-wider">
              Save current prompt as template
            </p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name"
              className="bg-[#0a0a1a] border-2 border-[#333366] text-white px-3 py-2 text-[10px] focus:border-[#3cf] focus:outline-none"
            />
            <button
              onClick={handleSaveAsTemplate}
              disabled={saving || !newName.trim()}
              className="px-3 py-2 text-[10px] text-[#0a0a1a] bg-[#3cf] font-semibold hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors uppercase"
            >
              {saving ? "Saving…" : "Save Template"}
            </button>
            {saveError && (
              <p className="text-[10px] text-[#ff3cac]">{saveError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
