import { useState } from "react";

/**
 * Single model slot card with x button, model label, endpoint badge,
 * system prompt preview, and expand button.
 *
 * @param {{
 *   model: { id: string, label: string, provider: string, endpoint_url?: string, color: string, system_prompt?: string },
 *   systemPrompt: string,
 *   onRemove: () => void,
 *   onPromptChange: (value: string) => void,
 *   canRemove: boolean
 * }} props
 */
export default function ModelSlotCard({
  model,
  systemPrompt = "",
  onRemove,
  onPromptChange,
  canRemove = true,
}) {
  const [expanded, setExpanded] = useState(false);

  const providerLabel =
    model.provider === "azure_foundry" ? "Foundry" : "OpenAI";

  return (
    <div
      className="flex flex-col bg-gray-800 border-2 rounded-lg overflow-hidden min-w-[220px] max-w-[280px]"
      style={{ borderColor: model.color }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: model.color }}
          />
          <span
            className="text-sm font-semibold truncate"
            style={{ color: model.color }}
          >
            {model.label}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-white text-xs px-1 transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "▲" : "▼"}
          </button>
          {canRemove && (
            <button
              onClick={onRemove}
              className="text-gray-400 hover:text-red-400 text-sm px-1 transition-colors"
              title="Remove model"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Badge row */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-gray-700 text-gray-300">
          {providerLabel}
        </span>
        {model.endpoint_url && (
          <span
            className="text-[10px] text-gray-500 truncate max-w-[140px]"
            title={model.endpoint_url}
          >
            {model.endpoint_url}
          </span>
        )}
      </div>

      {/* System prompt preview / editor */}
      {!expanded && systemPrompt && (
        <div className="px-3 pb-2">
          <p className="text-xs text-gray-500 truncate">{systemPrompt}</p>
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3">
          <textarea
            value={systemPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={3}
            placeholder="Enter system prompt…"
            className="w-full bg-gray-900 border border-gray-600 text-white rounded px-2 py-1 text-xs resize-y focus:border-cyan-400 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
