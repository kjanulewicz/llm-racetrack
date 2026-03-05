import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";

/**
 * Fetches and manages the user's saved prompt templates.
 *
 * @returns {{ templates: Array, loading: boolean, error: string|null, refresh: () => void, saveTemplate: (name: string, content: string) => Promise<void> }}
 */
export default function usePromptTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/me/prompts");
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  async function saveTemplate(name, content) {
    const res = await apiFetch("/api/me/prompts", {
      method: "POST",
      body: JSON.stringify({ name, content }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Save failed (${res.status})`);
    }

    await fetchTemplates();
  }

  return { templates, loading, error, refresh: fetchTemplates, saveTemplate };
}
