import TokenBadge from "./TokenBadge";
import { formatDuration } from "../utils/formatting";

const POSITION_LABELS = {
  1: "🥇 1st",
  2: "🥈 2nd",
  3: "🥉 3rd",
  4: "4th",
};

/**
 * Shown per model after done event.
 * Displays response text, total elapsed time, TTFT, and token counts.
 *
 * @param {{
 *   modelLabel: string,
 *   color: string,
 *   state: { text: string, elapsed_ms: number|null, ttft_ms: number|null, usage: object|null, status: string, finish_position: number|null },
 *   raceId: string|null,
 *   onShare: () => void
 * }} props
 */
export default function ResultCard({
  modelLabel,
  color,
  state,
  raceId,
  onShare,
}) {
  const { text, elapsed_ms, ttft_ms, usage, status, finish_position } = state;

  const isError = status === "error";

  return (
    <div
      className="flex flex-col bg-gray-800 border-2 rounded-lg overflow-hidden"
      style={{ borderColor: isError ? "#ef4444" : color }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold" style={{ color }}>
            {modelLabel}
          </span>
          {finish_position && (
            <span className="text-xs text-gray-300">
              {POSITION_LABELS[finish_position] || `${finish_position}th`}
            </span>
          )}
        </div>

        {raceId && onShare && (
          <button
            onClick={onShare}
            className="text-xs text-cyan-400 hover:text-cyan-300 uppercase tracking-wider transition-colors"
          >
            Share
          </button>
        )}
      </div>

      {/* Timing row */}
      <div className="flex gap-4 px-4 py-2 text-xs text-gray-400">
        <span>
          Total:{" "}
          <span className="text-white">{formatDuration(elapsed_ms)}</span>
        </span>
        <span>
          TTFT: <span className="text-white">{formatDuration(ttft_ms)}</span>
        </span>
      </div>

      {/* Token badges */}
      {usage && (
        <div className="px-4 pb-2">
          <TokenBadge usage={usage} />
        </div>
      )}

      {/* Response text */}
      <div className="px-4 pb-4">
        <pre
          className={`text-sm whitespace-pre-wrap break-words max-h-64 overflow-y-auto ${
            isError ? "text-red-400" : "text-gray-200"
          }`}
        >
          {text || (isError ? "Error occurred" : "No response")}
        </pre>
      </div>
    </div>
  );
}
