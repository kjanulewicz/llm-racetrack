import { formatDate } from "../utils/formatting";

/**
 * Displays a list of past races with metadata.
 * Clicking a race opens replay view.
 *
 * @param {{
 *   races: Array<{ id: string, created_at: string, user_input: string, models: Array<{ label: string }> }>,
 *   loading: boolean,
 *   onSelect: (id: string) => void
 * }} props
 */
export default function HistoryList({ races, loading, onSelect }) {
  if (loading) {
    return <p className="text-[10px] text-gray-600">Loading history…</p>;
  }

  if (races.length === 0) {
    return <p className="text-[10px] text-gray-600">No races yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {races.map((race) => (
        <button
          key={race.id}
          onClick={() => onSelect(race.id)}
          className="text-left p-4 bg-[#0e0e24] border-2 border-[#333366] hover:border-[#3cf] transition-colors"
          style={{ boxShadow: "none" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 12px rgba(51,204,255,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] text-gray-500">
              {formatDate(race.created_at)}
            </span>
            <span className="text-[8px] text-gray-600">
              {race.models?.length || 0} models
            </span>
          </div>
          <p className="text-[10px] text-white truncate uppercase">
            {race.user_input || "—"}
          </p>
          {race.models && (
            <div className="flex gap-2 mt-2">
              {race.models.map((m, i) => (
                <span
                  key={i}
                  className="text-[8px] uppercase tracking-wider px-2 py-0.5 bg-[#1a1a3e] text-gray-400 border border-[#333366]"
                >
                  {m.label || m.model_config_id}
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
