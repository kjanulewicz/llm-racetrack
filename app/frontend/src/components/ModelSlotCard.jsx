import { useState } from "react";

const PROVIDER_LABELS = {
  azure_foundry: "Foundry",
  azure_openai: "OpenAI",
};

/**
 * Single model slot card — arcade "player select" style with pixel border glow
 * in model neon color, x button, model label, endpoint badge,
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

  const providerLabel = PROVIDER_LABELS[model.provider] || model.provider;
  const color = model.color || "#3cf";

  return (
    <div
      className="flex flex-col bg-[#0e0e24] border-2 overflow-hidden min-w-[220px] max-w-[280px]"
      style={{
        borderColor: color,
        boxShadow: `0 0 12px ${color}, inset 0 0 8px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block w-2 h-2 shrink-0"
            style={{ backgroundColor: color }}
          />
          <span
            className="text-[10px] font-semibold truncate uppercase neon-flicker"
            style={{
              color,
              textShadow: `0 0 6px ${color}`,
            }}
          >
            {model.label}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-500 hover:text-white text-[10px] px-1 transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "▲" : "▼"}
          </button>
          {canRemove && (
            <button
              onClick={onRemove}
              className="text-gray-500 hover:text-[#ff3cac] text-[10px] px-1 transition-colors"
              title="Remove model"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Badge row */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <span className="text-[8px] uppercase tracking-wider px-2 py-0.5 bg-[#1a1a3e] text-gray-400 border border-[#333366]">
          {providerLabel}
        </span>
        {model.endpoint_url && (
          <span
            className="text-[8px] text-gray-600 truncate max-w-[140px]"
            title={model.endpoint_url}
          >
            {model.endpoint_url}
          </span>
        )}
      </div>

      {/* System prompt preview / editor */}
      {!expanded && systemPrompt && (
        <div className="px-3 pb-2">
          <p className="text-[8px] text-gray-500 truncate">{systemPrompt}</p>
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3">
          <textarea
            value={systemPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={3}
            placeholder="Enter system prompt…"
            className="w-full bg-[#0a0a1a] border-2 border-[#333366] text-white px-2 py-1 text-[10px] resize-y focus:border-[#3cf] focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
