import { useState } from "react";

/**
 * Textarea for user input and START RACE button.
 * Button is disabled until >= 2 models are selected and input is non-empty.
 *
 * @param {{
 *   onStartRace: (input: string) => void,
 *   activeModelCount: number,
 *   disabled: boolean,
 *   raceStatus: string
 * }} props
 */
export default function InputPanel({
  onStartRace,
  activeModelCount = 0,
  disabled = false,
  raceStatus = "idle",
}) {
  const [input, setInput] = useState("");

  const canStart =
    input.trim().length > 0 && activeModelCount >= 2 && !disabled;

  function handleStart() {
    if (canStart) {
      onStartRace(input.trim());
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && e.ctrlKey && canStart) {
      handleStart();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400 uppercase tracking-wide">
          User Prompt
        </span>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="Enter your prompt here…"
          disabled={raceStatus === "running"}
          className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-sm resize-y focus:border-cyan-400 focus:outline-none disabled:opacity-50"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="px-6 py-3 text-sm font-bold text-gray-900 bg-cyan-400 rounded uppercase tracking-wider hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {raceStatus === "running" ? "Racing…" : "Start Race"}
        </button>

        {activeModelCount < 2 && (
          <span className="text-xs text-gray-500">
            Select at least 2 models to start
          </span>
        )}
      </div>
    </div>
  );
}
