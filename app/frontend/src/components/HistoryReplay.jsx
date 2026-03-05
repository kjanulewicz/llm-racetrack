import ResultCard from "./ResultCard";
import { formatDate } from "../utils/formatting";

/**
 * Renders result cards from saved race data (no live animation).
 *
 * @param {{
 *   race: { id: string, created_at: string, user_input: string, results: Array<{ model_config_id: string, label: string, color: string, text: string, elapsed_ms: number, ttft_ms: number, usage: object, finish_position: number }> } | null,
 *   loading: boolean,
 *   onBack: () => void
 * }} props
 */
export default function HistoryReplay({ race, loading, onBack }) {
  if (loading) {
    return <p className="text-[10px] text-gray-600">Loading race data…</p>;
  }

  if (!race) {
    return <p className="text-[10px] text-gray-600">Race not found.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-[10px] neon-cyan transition-colors hover:opacity-80 uppercase"
        >
          ← Back to list
        </button>
        <span className="text-[8px] text-gray-600">
          {formatDate(race.created_at)}
        </span>
      </div>

      <div className="p-4 bg-[#0e0e24] border-2 border-[#333366]">
        <span className="text-[8px] text-gray-500 uppercase tracking-wider">
          User Prompt
        </span>
        <p className="text-[10px] text-white mt-1">{race.user_input}</p>
      </div>

      <div className="results-grid">
        {(race.results || []).map((r) => (
          <ResultCard
            key={r.model_config_id}
            modelLabel={r.label || r.model_config_id}
            color={r.color || "#38bdf8"}
            state={{
              text: r.text || "",
              elapsed_ms: r.elapsed_ms,
              ttft_ms: r.ttft_ms,
              usage: r.usage || null,
              status: "done",
              finish_position: r.finish_position,
            }}
            raceId={null}
            onShare={null}
          />
        ))}
      </div>
    </div>
  );
}
