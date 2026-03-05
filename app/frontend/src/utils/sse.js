import { msalInstance } from "../auth/msalInstance";
import { loginRequest } from "../auth/msal.config";

/**
 * Opens a POST-based SSE stream with Bearer token authentication.
 * Returns an object with an `abort()` method and iterates over parsed
 * SSE events via the provided `onEvent` callback.
 *
 * Each event has the shape: { event: string, data: object }
 *
 * @param {string} url - API endpoint (e.g. "/api/race")
 * @param {object} body - JSON body to POST
 * @param {(event: {event: string, data: object}) => void} onEvent - callback per SSE event
 * @param {() => void} [onDone] - called when stream ends
 * @param {(error: Error) => void} [onError] - called on fetch/parse error
 * @returns {{ abort: () => void }}
 */
export function openSSEStream(url, body, onEvent, onDone, onError) {
  const controller = new AbortController();

  (async () => {
    try {
      let token = "";
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        const response = await msalInstance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
        token = response.accessToken;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Race request failed (${res.status}): ${text}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "message";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const raw = line.slice(5).trim();
            if (raw) {
              try {
                const data = JSON.parse(raw);
                onEvent({ event: currentEvent, data });
              } catch {
                onEvent({ event: currentEvent, data: { raw } });
              }
            }
            currentEvent = "message";
          }
        }
      }

      if (onDone) onDone();
    } catch (err) {
      if (err.name !== "AbortError") {
        if (onError) onError(err);
      }
    }
  })();

  return { abort: () => controller.abort() };
}
