import { useState } from "react";

/**
 * Collapsible system prompt textarea for a model slot.
 *
 * @param {{ value: string, onChange: (value: string) => void, modelLabel: string, color: string }} props
 */
export default function SystemPromptEditor({
  value,
  onChange,
  modelLabel,
  color = "#38bdf8",
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[8px] uppercase tracking-wider text-gray-500 hover:text-white transition-colors"
      >
        <span
          className="inline-block w-2 h-2"
          style={{ backgroundColor: color }}
        />
        <span>System Prompt — {modelLabel}</span>
        <span className="ml-auto">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="Enter system prompt…"
          className="bg-[#0a0a1a] border-2 border-[#333366] text-white px-3 py-2 text-[10px] resize-y focus:border-[#3cf] focus:outline-none"
        />
      )}

      {!expanded && value && (
        <p className="text-[8px] text-gray-600 truncate pl-4">{value}</p>
      )}
    </div>
  );
}
