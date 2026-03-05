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
    return <p className="text-gray-500 text-sm">Loading history…</p>;
  }

  if (races.length === 0) {
    return <p className="text-gray-500 text-sm">No races yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {races.map((race) => (
        <button
          key={race.id}
          onClick={() => onSelect(race.id)}
          className="text-left p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-cyan-400 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">
              {formatDate(race.created_at)}
            </span>
            <span className="text-xs text-gray-500">
              {race.models?.length || 0} models
            </span>
          </div>
          <p className="text-sm text-white truncate">
            {race.user_input || "—"}
          </p>
          {race.models && (
            <div className="flex gap-2 mt-2">
              {race.models.map((m, i) => (
                <span
                  key={i}
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-gray-700 text-gray-300"
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
