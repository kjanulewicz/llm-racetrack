import { useState, useCallback } from "react";
import { apiFetch } from "../utils/api";

/**
 * Lazily fetches the user's Azure AI Foundry resources (subscriptions + workspaces)
 * when explicitly called. Suitable for triggering when the Add Model modal opens.
 *
 * @returns {{ resources: Array, loading: boolean, error: string|null, fetchResources: () => Promise<void> }}
 */
export default function useFoundryResources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/azure/foundry-resources");
      if (res.ok) {
        setResources(await res.json());
      } else {
        setError(`Failed to load resources (${res.status})`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Derive unique subscriptions from the flat resources list
  const subscriptions = Array.from(
    new Map(
      resources.map((r) => [
        r.subscription_id,
        { id: r.subscription_id, name: r.subscription_name },
      ])
    ).values()
  );

  return { resources, subscriptions, loading, error, fetchResources };
}
