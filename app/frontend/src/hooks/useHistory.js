import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";

/**
 * Fetches the user's race history and provides methods
 * to load individual race details for replay.
 *
 * @returns {{
 *   races: Array,
 *   loading: boolean,
 *   error: string|null,
 *   refresh: () => void,
 *   loadRace: (id: string) => Promise<object>,
 *   raceDetail: object|null,
 *   detailLoading: boolean
 * }}
 */
export default function useHistory() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [raceDetail, setRaceDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchRaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/me/history");
      if (res.ok) {
        setRaces(await res.json());
      } else {
        setError(`Failed to load history (${res.status})`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRaces();
  }, [fetchRaces]);

  const loadRace = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/me/history/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRaceDetail(data);
        return data;
      } else {
        throw new Error(`Failed to load race (${res.status})`);
      }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  return {
    races,
    loading,
    error,
    refresh: fetchRaces,
    loadRace,
    raceDetail,
    detailLoading,
  };
}
