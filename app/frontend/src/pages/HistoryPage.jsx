import { useState } from "react";
import useHistory from "../hooks/useHistory";
import HistoryList from "../components/HistoryList";
import HistoryReplay from "../components/HistoryReplay";

/**
 * Lists past races from /api/me/history.
 * Click to replay (renders result cards from saved data, no live animation).
 */
export default function HistoryPage() {
  const { races, loading, error, loadRace, raceDetail, detailLoading } =
    useHistory();
  const [selectedId, setSelectedId] = useState(null);

  async function handleSelect(id) {
    setSelectedId(id);
    await loadRace(id);
  }

  function handleBack() {
    setSelectedId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm neon-cyan neon-flicker uppercase tracking-wider">
        Race History
      </h2>

      {error && <p className="text-[10px] text-[#ff3cac]">{error}</p>}

      {selectedId ? (
        <HistoryReplay
          race={raceDetail}
          loading={detailLoading}
          onBack={handleBack}
        />
      ) : (
        <HistoryList
          races={races}
          loading={loading}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
