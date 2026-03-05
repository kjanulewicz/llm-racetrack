import { useState } from "react";
import { apiFetch } from "../utils/api";

/**
 * Modal with email input that calls POST /api/race/{id}/share.
 *
 * @param {{ open: boolean, raceId: string, onClose: () => void }} props
 */
export default function ShareModal({ open, raceId, onClose }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  async function handleShare() {
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await apiFetch(`/api/race/${raceId}/share`, {
        method: "POST",
        body: JSON.stringify({ recipient_email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Share failed (${res.status})`);
      }

      setSuccess(true);
      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setEmail("");
    setError(null);
    setSuccess(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg shadow-lg shadow-cyan-400/20 w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
            Share Race
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Colleague&apos;s Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@org.com"
              className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-sm focus:border-cyan-400 focus:outline-none"
            />
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && (
            <p className="text-green-400 text-sm">
              Race shared successfully!
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded hover:text-white hover:border-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleShare}
              disabled={sending || !email.trim()}
              className="px-4 py-2 text-sm text-gray-900 bg-cyan-400 rounded font-semibold hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? "Sharing…" : "Share"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
