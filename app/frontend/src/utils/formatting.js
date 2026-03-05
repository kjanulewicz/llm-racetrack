/**
 * Formats a duration in milliseconds to a human-readable string.
 * @param {number} ms - duration in milliseconds
 * @returns {string} e.g. "1.23s" or "450ms"
 */
export function formatDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Formats a token count with a label.
 * @param {number} count
 * @returns {string}
 */
export function formatTokenCount(count) {
  if (count == null) return "—";
  return count.toLocaleString();
}

/**
 * Formats a date string to a locale-appropriate short format.
 * @param {string} dateStr - ISO date string
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
