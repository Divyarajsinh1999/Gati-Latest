/**
 * Small localStorage cache with a TTL. This runs in the user's own browser
 * once the app is deployed (NOT inside a Claude.ai artifact sandbox, where
 * browser storage is unavailable) — real localStorage is fine and standard
 * practice for a deployed Vite/Netlify app.
 *
 * Purpose: avoid re-fetching the same historical window or quote on every
 * render/navigation (spec Section 4: "sensible refresh interval... without
 * making unnecessary requests").
 */
const PREFIX = 'imd:'; // Indian Momentum Dashboard

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { value, expiresAt } = JSON.parse(raw);
    if (expiresAt && Date.now() > expiresAt) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return value;
  } catch {
    return null; // corrupted entry or storage unavailable — treat as a cache miss
  }
}

export function cacheSet(key, value, ttlMs) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, expiresAt: ttlMs ? Date.now() + ttlMs : null }));
  } catch {
    // Storage full or unavailable — non-fatal, just means this call won't be cached.
  }
}
