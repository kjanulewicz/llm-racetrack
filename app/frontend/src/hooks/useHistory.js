import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";

const LS_HISTORY_KEY = "llm-racetrack-history";
const MAX_CACHED_RACES = 5;

/**
 * Reads cached race history from localStorage.
 * @returns {Array}
 */
function readCachedHistory() {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupt data
  }
  return [];
}

/**
 * Writes race history to localStorage (last N races).
 * @param {Array} races
 */
function writeCachedHistory(races) {
  try {
    const trimmed = races.slice(0, MAX_CACHED_RACES);
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // storage full or unavailable
  }
}

/**
 * Caches a single race detail for replay.
 * @param {object} race
 */
function cacheRaceDetail(race) {
  if (!race || !race.id) return;
  try {
    const key = `${LS_HISTORY_KEY}-detail-${race.id}`;
    localStorage.setItem(key, JSON.stringify(race));
  } catch {
    // ignore
  }
}

/**
 * Reads a cached race detail.
 * @param {string} id
 * @returns {object|null}
 */
function readCachedRaceDetail(id) {
  try {
    const key = `${LS_HISTORY_KEY}-detail-${id}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

/**
 * Fetches the user's race history and provides methods
 * to load individual race details for replay.
 * Caches last 5 races in localStorage for fast loading.
 * Syncs with /api/me/history on load.
 *
 * @returns {{
 *   races: Array,
 *   loading: boolean,
 *   error: string|null,
 *   refresh: () => void,
 *   loadRace: (id: string) => Promise<object>,
 *   raceDetail: object|null,
 *   detailLoading: boolean,
 *   saveToCache: (race: object) => void
 * }}
 */
export default function useHistory() {
  // Initialize from cache for instant display
  const [races, setRaces] = useState(() => readCachedHistory());
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
        const data = await res.json();
        setRaces(data);
        // Update localStorage cache with latest from server
        writeCachedHistory(data);
      } else {
        setError(`Failed to load history (${res.status})`);
        // Keep cached data on error
      }
    } catch (err) {
      setError(err.message);
      // Keep cached data on network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRaces();
  }, [fetchRaces]);

  const loadRace = useCallback(async (id) => {
    setDetailLoading(true);

    // Try cache first for instant display
    const cached = readCachedRaceDetail(id);
    if (cached) {
      setRaceDetail(cached);
      setDetailLoading(false);
    }

    try {
      const res = await apiFetch(`/api/me/history/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRaceDetail(data);
        // Cache this detail for future replays
        cacheRaceDetail(data);
        return data;
      } else {
        // If API fails but we have cache, keep it
        if (!cached) {
          throw new Error(`Failed to load race (${res.status})`);
        }
        return cached;
      }
    } catch (err) {
      if (!cached) {
        setError(err.message);
      }
      return cached || null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  /**
   * Saves a completed race to the local cache for immediate history access.
   * Called after a race completes on the RacePage.
   * @param {object} race
   */
  const saveToCache = useCallback((race) => {
    if (!race) return;
    cacheRaceDetail(race);
    setRaces((prev) => {
      const filtered = prev.filter((r) => r.id !== race.id);
      const next = [race, ...filtered].slice(0, MAX_CACHED_RACES);
      writeCachedHistory(next);
      return next;
    });
  }, []);

  return {
    races,
    loading,
    error,
    refresh: fetchRaces,
    loadRace,
    raceDetail,
    detailLoading,
    saveToCache,
  };
}
