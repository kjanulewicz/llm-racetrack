import { useState } from "react";
import FoundryResourcePicker from "./FoundryResourcePicker";
import { apiFetch } from "../utils/api";

const NEON_COLORS = ["#00ff88", "#ff3cac", "#ffee00", "#33ccff", "#f97316"];

const PROVIDERS = [
  { value: "azure_openai", label: "Azure OpenAI" },
  { value: "azure_foundry", label: "Azure AI Foundry" },
];

/**
 * Two-panel form for adding a new model slot (section 7.3 of the brief).
 * Provider toggle switches between Azure OpenAI and Azure AI Foundry panels.
 *
 * @param {{ open: boolean, onClose: () => void, onSaved: () => void }} props
 */
export default function AddModelModal({ open, onClose, onSaved }) {
  const [provider, setProvider] = useState("azure_openai");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(NEON_COLORS[0]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [resourceGroup, setResourceGroup] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  function handleFoundryUrlChange(url, meta) {
    setEndpointUrl(url);
    if (meta.subscription_id) setSubscriptionId(meta.subscription_id);
    if (meta.resource_group) setResourceGroup(meta.resource_group);
  }

  function resetForm() {
    setProvider("azure_openai");
    setEndpointUrl("");
    setModelName("");
    setLabel("");
    setColor(NEON_COLORS[0]);
    setSystemPrompt("");
    setSubscriptionId("");
    setResourceGroup("");
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        base_model_id: modelName,
        label: label || modelName,
        provider,
        color,
      };

      if (provider === "azure_foundry") {
        body.endpoint_url = endpointUrl;
        body.subscription_id = subscriptionId;
        body.resource_group = resourceGroup;
      }

      const res = await apiFetch("/api/me/models", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Save failed (${res.status})`);
      }

      resetForm();
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg shadow-lg shadow-cyan-400/20 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
            Configure Model
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          {/* Provider Toggle */}
          <div className="flex gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setProvider(p.value)}
                className={`flex-1 py-2 px-3 text-sm uppercase tracking-wide rounded border-2 transition-colors ${
                  provider === p.value
                    ? "border-cyan-400 text-cyan-400 bg-cyan-400/10"
                    : "border-gray-600 text-gray-400 hover:border-gray-500"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Foundry Resource Picker (Foundry only) */}
          {provider === "azure_foundry" && (
            <FoundryResourcePicker
              value={endpointUrl}
              onChange={handleFoundryUrlChange}
            />
          )}

          {/* Endpoint URL (always visible for Foundry, editable) */}
          {provider === "azure_foundry" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                Endpoint URL
              </span>
              <input
                type="url"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://<resource>.inference.ai.azure.com"
                className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-sm focus:border-cyan-400 focus:outline-none"
              />
            </label>
          )}

          {/* Model Name */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Model Name
            </span>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={
                provider === "azure_foundry"
                  ? "e.g. Mistral-large-2411"
                  : "e.g. gpt-4o"
              }
              className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-sm focus:border-cyan-400 focus:outline-none"
            />
          </label>

          {/* Label */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Label
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g. "Mistral EU West"'
              className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-sm focus:border-cyan-400 focus:outline-none"
            />
          </label>

          {/* Color Picker */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Color
            </span>
            <div className="flex gap-2">
              {NEON_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c
                      ? "border-white scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              System Prompt
            </span>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              placeholder="You are a helpful assistant."
              className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-sm resize-y focus:border-cyan-400 focus:outline-none"
            />
          </label>

          {/* Error */}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded hover:text-white hover:border-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !modelName}
              className="px-4 py-2 text-sm text-gray-900 bg-cyan-400 rounded font-semibold hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Save to my models"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
