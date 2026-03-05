import { useState, useEffect } from "react";
import useFoundryResources from "../hooks/useFoundryResources";

/**
 * Two-level dropdown picker for Azure AI Foundry resources.
 * Shows subscription and workspace dropdowns. Selecting a workspace
 * auto-fills the endpoint URL.
 *
 * @param {{ value: string, onChange: (url: string, meta: object) => void }} props
 */
export default function FoundryResourcePicker({ value, onChange }) {
  const { resources, subscriptions, loading, error, fetchResources } =
    useFoundryResources();
  const [selectedSub, setSelectedSub] = useState("");

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const workspaces = selectedSub
    ? resources.filter((r) => r.subscription_id === selectedSub)
    : [];

  function handleSubChange(e) {
    setSelectedSub(e.target.value);
    onChange("", {});
  }

  function handleWorkspaceChange(e) {
    const ws = workspaces.find((w) => w.workspace_name === e.target.value);
    if (ws) {
      onChange(ws.inference_endpoint, {
        subscription_id: ws.subscription_id,
        resource_group: ws.resource_group,
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Subscription Dropdown */}
      <label className="flex flex-col gap-1">
        <span className="text-[8px] text-gray-500 uppercase tracking-wider">
          Subscription
        </span>
        <select
          value={selectedSub}
          onChange={handleSubChange}
          disabled={loading}
          className="bg-[#0a0a1a] border-2 border-[#333366] text-white px-3 py-2 text-[10px] focus:border-[#3cf] focus:outline-none"
        >
          <option value="">
            {loading ? "Loading…" : "Select a subscription"}
          </option>
          {subscriptions.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name}
            </option>
          ))}
        </select>
      </label>

      {/* Workspace Dropdown */}
      <label className="flex flex-col gap-1">
        <span className="text-[8px] text-gray-500 uppercase tracking-wider">
          Workspace
        </span>
        <select
          value={
            workspaces.find((w) => w.inference_endpoint === value)
              ?.workspace_name || ""
          }
          onChange={handleWorkspaceChange}
          disabled={!selectedSub || loading}
          className="bg-[#0a0a1a] border-2 border-[#333366] text-white px-3 py-2 text-[10px] focus:border-[#3cf] focus:outline-none"
        >
          <option value="">Select a workspace</option>
          {workspaces.map((ws) => (
            <option key={ws.workspace_name} value={ws.workspace_name}>
              {ws.workspace_name}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-[10px] text-[#ff3cac]">{error}</p>}
    </div>
  );
}
