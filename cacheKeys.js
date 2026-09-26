/**
 * CACHE KEYS — stable, bounded identifiers for cached values.
 *
 * WHAT THIS OWNS
 *   Turning a request's inputs into a short, collision-resistant key.
 *
 * WHAT THIS MUST NEVER DO
 *   Produce a key that varies between runs for identical inputs. A key that
 *   drifts is a cache that never hits, which fails silently and looks exactly
 *   like a slow network.
 *
 * THE DEFECT THIS FIXES
 *   The quote cache key was `quote:{provider}:{all symbols joined by comma}`.
 *   For a 251-symbol universe that is a roughly 3-4 kB key string, and for all
 *   three universes about 7 kB — recreated, re-serialised and compared on
 *   every single lookup. It worked, but it made every cache read proportional
 *   to the size of the universe, and it put an unbounded string into a storage
 *   key where implementations have length limits.
 *
 * WHY FNV-1a
 *   Non-cryptographic, tiny, dependency-free, and stable across engines. There
 *   is no adversary here — the only requirement is that two different symbol
 *   lists do not collide, and 32 bits over an input space of a few hundred
 *   distinct universe/window combinations is ample. Symbols are sorted first
 *   so that a reordered list is recognised as the same request.
 */

/** FNV-1a, 32-bit, returned as 8 lowercase hex characters. */
export function hashString(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply, expressed as shifts to stay in int32.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Key for a batch of quotes.
 *
 * The symbol COUNT is kept in the clear alongside the hash. It costs nothing
 * and it makes a cache entry legible when debugging — `quote:yahoo:251:1a2b3c4d`
 * says what it is, where an opaque hash alone would not.
 */
export function quoteCacheKey(providerId, symbols) {
  const sorted = [...symbols].sort();
  return `quote:${providerId}:${sorted.length}:${hashString(sorted.join(','))}`;
}
