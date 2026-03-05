import TokenBadge from "./TokenBadge";
import { formatDuration } from "../utils/formatting";

const POSITION_LABELS = {
  1: "1ST",
  2: "2ND",
  3: "3RD",
  4: "4TH",
};

/**
 * Shown per model after done event — arcade styled.
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
  const isWinner = finish_position === 1;
  const borderColor = isError ? "#ef4444" : color;

  return (
    <div
      className={`flex flex-col bg-[#0e0e24] border-2 overflow-hidden ${
        isError ? "" : !isWinner && finish_position ? "opacity-50" : ""
      }`}
      style={{
        borderColor,
        boxShadow: isError
          ? "0 0 20px #ef4444, 0 0 40px #ef444444"
          : isWinner
          ? `0 0 20px ${color}, 0 0 40px ${color}44`
          : `0 0 8px ${borderColor}44`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#333366]">
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-3 h-3"
            style={{ backgroundColor: isError ? "#ef4444" : color }}
          />
          <span
            className={`text-[10px] font-semibold uppercase ${isError ? "error-flicker" : ""}`}
            style={{
              color: isError ? "#ef4444" : color,
              textShadow: isError
                ? "0 0 6px #ef4444"
                : `0 0 6px ${color}`,
            }}
          >
            {modelLabel}
          </span>
          {isError && (
            <span className="text-[10px] error-flicker font-bold uppercase">
              Crashed!
            </span>
          )}
          {!isError && finish_position && (
            <span
              className={`text-[10px] ${isWinner ? "neon-yellow blink" : "text-gray-500"}`}
            >
              {POSITION_LABELS[finish_position] || `${finish_position}TH`}
            </span>
          )}
        </div>

        {raceId && onShare && (
          <button
            onClick={onShare}
            className="text-[8px] neon-cyan uppercase tracking-wider transition-colors hover:opacity-80"
          >
            Share
          </button>
        )}
      </div>

      {/* Timing row */}
      {!isError && (
        <div className="flex gap-4 px-4 py-2 text-[8px] text-gray-500 uppercase">
          <span>
            Total:{" "}
            <span className="text-white">{formatDuration(elapsed_ms)}</span>
          </span>
          <span>
            TTFT: <span className="text-white">{formatDuration(ttft_ms)}</span>
          </span>
        </div>
      )}

      {/* Error timing placeholder */}
      {isError && (
        <div className="flex gap-4 px-4 py-2 text-[8px] uppercase">
          <span className="text-[#ef4444]">⚠ Error — Model Failed</span>
        </div>
      )}

      {/* Token badges */}
      {usage && !isError && (
        <div className="px-4 pb-2">
          <TokenBadge usage={usage} />
        </div>
      )}

      {/* Response text / Error message */}
      <div className="px-4 pb-4">
        <pre
          className={`text-[10px] whitespace-pre-wrap break-words max-h-64 overflow-y-auto ${
            isError ? "text-[#ff3cac]" : "text-gray-300"
          }`}
        >
          {isError
            ? `🔥 ${text || "An error occurred while processing this model's response."}`
            : text || "No response"}
        </pre>
      </div>
    </div>
  );
}
