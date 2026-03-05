import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";

/**
 * Fetches the user's saved model configs and the org-wide defaults on mount,
 * then merges them into a single combined list.
 *
 * @returns {{ models: Array, defaults: Array, userModels: Array, loading: boolean, error: string|null, refresh: () => void }}
 */
export default function useModels() {
  const [defaults, setDefaults] = useState([]);
  const [userModels, setUserModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [defaultsRes, userRes] = await Promise.all([
        apiFetch("/api/models/defaults"),
        apiFetch("/api/me/models"),
      ]);

      if (defaultsRes.ok) {
        setDefaults(await defaultsRes.json());
      }
      if (userRes.ok) {
        setUserModels(await userRes.json());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Merge: user models take priority; add any defaults not already configured
  const userModelBaseIds = new Set(userModels.map((m) => m.base_model_id));
  const combined = [
    ...userModels,
    ...defaults
      .filter((d) => !userModelBaseIds.has(d.id))
      .map((d) => ({
        id: d.id,
        base_model_id: d.id,
        label: d.name,
        provider: d.provider,
        endpoint_url: d.default_endpoint_url || null,
        color: "#38bdf8",
        isDefault: true,
      })),
  ];

  return {
    models: combined,
    defaults,
    userModels,
    loading,
    error,
    refresh: fetchModels,
  };
}
