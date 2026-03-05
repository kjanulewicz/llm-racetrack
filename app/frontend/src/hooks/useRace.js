import { useState, useCallback, useRef } from "react";
import { openSSEStream } from "../utils/sse";

/**
 * Hook that manages a race session via SSE streaming.
 *
 * Opens a POST /api/race SSE stream, parses chunk / ttft / done / error events,
 * and returns per-model state.
 *
 * @returns {{
 *   modelStates: Record<string, { text: string, elapsed_ms: number|null, ttft_ms: number|null, usage: object|null, status: string, finish_position: number|null }>,
 *   raceId: string|null,
 *   status: string,
 *   startRace: (userInput: string, models: Array<{ model_config_id: string, system_prompt: string }>) => void,
 *   reset: () => void
 * }}
 */
export default function useRace() {
  const [modelStates, setModelStates] = useState({});
  const [raceId, setRaceId] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const streamRef = useRef(null);
  const finishCounterRef = useRef(0);

  const startRace = useCallback((userInput, models) => {
    // Reset state
    const initial = {};
    for (const m of models) {
      initial[m.model_config_id] = {
        text: "",
        elapsed_ms: null,
        ttft_ms: null,
        usage: null,
        status: "running",
        finish_position: null,
      };
    }
    setModelStates(initial);
    setRaceId(null);
    setStatus("running");
    finishCounterRef.current = 0;

    const totalModels = models.length;

    const body = {
      user_input: userInput,
      models: models.map((m) => ({
        model_config_id: m.model_config_id,
        system_prompt: m.system_prompt,
      })),
    };

    if (streamRef.current) {
      streamRef.current.abort();
    }

    streamRef.current = openSSEStream(
      "/api/race",
      body,
      (evt) => {
        const { event, data } = evt;
        const id = data.model_config_id;

        if (event === "chunk" && id) {
          setModelStates((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              text: (prev[id]?.text || "") + (data.text || ""),
            },
          }));
        } else if (event === "ttft" && id) {
          setModelStates((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              ttft_ms: data.ttft_ms,
            },
          }));
        } else if (event === "done" && id) {
          finishCounterRef.current += 1;
          const position = finishCounterRef.current;

          setModelStates((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              elapsed_ms: data.elapsed_ms,
              usage: data.usage || null,
              status: "done",
              finish_position: position,
              text: data.text || prev[id]?.text || "",
            },
          }));

          if (data.race_id) {
            setRaceId(data.race_id);
          }

          if (position >= totalModels) {
            setStatus("done");
          }
        } else if (event === "error" && id) {
          setModelStates((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              status: "error",
              text: data.message || data.error || "Unknown error",
            },
          }));
          // Check if all models done or errored
          finishCounterRef.current += 1;
          if (finishCounterRef.current >= totalModels) {
            setStatus("done");
          }
        }
      },
      () => {
        // Stream ended
        setStatus((prev) => (prev === "running" ? "done" : prev));
      },
      (err) => {
        setStatus("error");
        console.error("Race SSE error:", err);
      }
    );
  }, []);

  const reset = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.abort();
      streamRef.current = null;
    }
    setModelStates({});
    setRaceId(null);
    setStatus("idle");
    finishCounterRef.current = 0;
  }, []);

  return { modelStates, raceId, status, startRace, reset };
}
