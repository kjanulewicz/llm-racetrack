import { useState } from "react";

/**
 * Textarea for user input and START RACE button — arcade styled.
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
        <span className="text-[8px] text-gray-500 uppercase tracking-wider">
          {">"} Your Prompt
        </span>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="Enter your prompt here…"
          disabled={raceStatus === "running"}
          className="bg-[#0e0e24] border-2 border-[#333366] text-white px-3 py-2 text-[10px] resize-y focus:border-[#3cf] focus:outline-none disabled:opacity-50"
          style={{ fontFamily: '"Press Start 2P", monospace' }}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="px-6 py-3 text-[10px] font-bold bg-[#0a0a1a] text-[#00ff88] uppercase tracking-wider pixel-border-green hover:bg-[#00ff88] hover:text-[#0a0a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {raceStatus === "running" ? "Racing…" : "Start Race"}
        </button>

        {activeModelCount < 2 && (
          <span className="text-[8px] text-gray-600 uppercase">
            Select at least 2 models to start
          </span>
        )}
      </div>
    </div>
  );
}
