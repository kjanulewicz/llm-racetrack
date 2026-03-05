import { formatTokenCount } from "../utils/formatting";

/**
 * Displays prompt / cached / completion token counts as inline badges.
 *
 * @param {{ usage: { prompt_tokens?: number, cached_tokens?: number, completion_tokens?: number, total_tokens?: number } | null }} props
 */
export default function TokenBadge({ usage }) {
  if (!usage) return null;

  const items = [
    { label: "Prompt", value: usage.prompt_tokens },
    { label: "Cached", value: usage.cached_tokens },
    { label: "Completion", value: usage.completion_tokens },
    { label: "Total", value: usage.total_tokens },
  ].filter((item) => item.value != null);

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1 text-[8px] uppercase tracking-wider px-2 py-0.5 bg-[#1a1a3e] text-gray-400 border border-[#333366]"
        >
          <span className="text-gray-600">{item.label}:</span>
          <span className="text-white">{formatTokenCount(item.value)}</span>
        </span>
      ))}
    </div>
  );
}
