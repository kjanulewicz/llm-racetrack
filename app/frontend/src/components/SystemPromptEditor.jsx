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
        className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400 hover:text-white transition-colors"
      >
        <span
          className="inline-block w-2 h-2 rounded-full"
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
          className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-sm resize-y focus:border-cyan-400 focus:outline-none"
        />
      )}

      {!expanded && value && (
        <p className="text-xs text-gray-500 truncate pl-4">{value}</p>
      )}
    </div>
  );
}
