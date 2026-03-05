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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#0e0e24] border-2 border-[#3cf] w-full max-w-sm mx-4"
        style={{ boxShadow: "0 0 20px rgba(51,204,255,0.3)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[#333366]">
          <h2 className="text-[10px] neon-cyan uppercase tracking-wider">
            Share Race
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white text-sm leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[8px] text-gray-500 uppercase tracking-wider">
              Colleague&apos;s Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@org.com"
              className="bg-[#0a0a1a] border-2 border-[#333366] text-white px-3 py-2 text-[10px] focus:border-[#3cf] focus:outline-none"
            />
          </label>

          {error && <p className="text-[10px] text-[#ff3cac]">{error}</p>}
          {success && (
            <p className="text-[10px] neon-green">
              Race shared successfully!
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-[10px] text-gray-500 border-2 border-[#333366] hover:text-white hover:border-gray-400 transition-colors uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleShare}
              disabled={sending || !email.trim()}
              className="px-4 py-2 text-[10px] text-[#0a0a1a] bg-[#3cf] font-semibold hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors uppercase"
            >
              {sending ? "Sharing…" : "Share"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
