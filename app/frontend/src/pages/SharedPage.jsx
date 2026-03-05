import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";
import HistoryList from "../components/HistoryList";
import HistoryReplay from "../components/HistoryReplay";

/**
 * Same layout as HistoryPage but fetches /api/me/shared.
 * Shows race results shared with the authenticated user.
 */
export default function SharedPage() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [raceDetail, setRaceDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchShared = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/me/shared");
      if (res.ok) {
        setRaces(await res.json());
      } else {
        setError(`Failed to load shared races (${res.status})`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShared();
  }, [fetchShared]);

  async function handleSelect(id) {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/me/history/${id}`);
      if (res.ok) {
        setRaceDetail(await res.json());
      } else {
        setError(`Failed to load race (${res.status})`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleBack() {
    setSelectedId(null);
    setRaceDetail(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm neon-cyan neon-flicker uppercase tracking-wider">
        Shared with Me
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
