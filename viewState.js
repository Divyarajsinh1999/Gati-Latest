/**
 * VIEW STATE — remembering where the user was.
 *
 * WHAT THIS OWNS
 *   Scroll position, expanded sections, search text, active filter and the
 *   entered investment amount, per route, for the length of a session.
 *
 * WHAT THIS MUST NEVER DO
 *   Persist across sessions. A remembered scroll position from three days ago
 *   is not context, it is confusion — the data has changed underneath it and
 *   the row you were looking at may not be there. Only PREFERENCES survive a
 *   session (last universe, window, amount); position does not.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A MODULE AND NOT A HOOK WITH useState
 *
 * The state has to outlive the component. That is the entire requirement:
 * when someone opens the full ranking, scrolls to row 180, taps a stock, and
 * comes back, the list component has unmounted and remounted in between. Any
 * state held inside it is gone by then.
 *
 * So it lives in a module-level map keyed by route, and components read it on
 * mount and write it on change. The map is deliberately plain — no context
 * provider, no reducer, no subscription — because nothing needs to re-render
 * when it changes. It is read once at mount and written on the way out.
 *
 * BOUNDED, because an unbounded map keyed by URL grows for as long as the tab
 * is open, and a user browsing every stock in Smallcap 250 would accumulate
 * 250 entries of dead state.
 * ═════════════════════════════════════════════════════════════════════════
 */

/** Distinct routes remembered at once. Beyond this, the oldest is dropped. */
const MAX_ENTRIES = 30;

/** @type {Map<string, object>} insertion-ordered, so the first key is oldest */
const viewState = new Map();

/**
 * The key a route remembers under.
 *
 * Deliberately the pathname WITHOUT the query string. Two visits to the same
 * ranking differing only by a transient query parameter are the same place to
 * a person, and keying on the full URL would lose the scroll position every
 * time anything incidental changed.
 */
export function viewKey(pathname) {
  return String(pathname).replace(/\/+$/, '') || '/';
}

/**
 * Read remembered state for a route. Always returns an object, never null, so
 * callers can destructure with defaults rather than guarding first.
 */
export function readViewState(pathname) {
  return viewState.get(viewKey(pathname)) ?? {};
}

/** Merge into a route's remembered state. Partial by design: a component that
 *  only knows about scroll must not have to preserve someone else's filter. */
export function writeViewState(pathname, patch) {
  const key = viewKey(pathname);
  const next = { ...(viewState.get(key) ?? {}), ...patch };

  // Re-inserting moves the key to the end, so recency ordering is maintained
  // without a separate timestamp.
  viewState.delete(key);
  viewState.set(key, next);

  while (viewState.size > MAX_ENTRIES) {
    viewState.delete(viewState.keys().next().value);
  }
  return next;
}

/**
 * Forget one route, or everything.
 *
 * Used when the underlying data changes enough that a remembered position
 * would be misleading — a rebalance reorders the ranking, so row 180 is no
 * longer the row the user was reading.
 */
export function clearViewState(pathname) {
  if (pathname === undefined) {
    viewState.clear();
    return;
  }
  viewState.delete(viewKey(pathname));
}

/** Forget every route belonging to a universe. */
export function clearUniverseViewState(universeKey) {
  let removed = 0;
  for (const key of [...viewState.keys()]) {
    if (key === `/${universeKey}` || key.startsWith(`/${universeKey}/`)) {
      viewState.delete(key);
      removed++;
    }
  }
  return removed;
}

export function viewStateSize() {
  return viewState.size;
}

/* ------------------------------------------------------------------ */
/* SCROLL                                                              */
/* ------------------------------------------------------------------ */

/**
 * Restore a scroll position.
 *
 * WHY THIS WAITS FOR TWO FRAMES
 *   On mount the list is usually still a skeleton, so the document is shorter
 *   than its final height and scrolling to 4,200px would clamp to the bottom.
 *   Two frames is enough for layout to settle in the common case; the height
 *   check below covers the rest.
 *
 * WHY IT GIVES UP RATHER THAN GUESSING
 *   If the page is still too short, the honest outcome is to stay at the top.
 *   Scrolling to an approximate position lands the reader somewhere they never
 *   were, which is worse than an obvious reset.
 */
export function restoreScroll(top, { scroller = globalThis, raf = globalThis.requestAnimationFrame } = {}) {
  if (!top || top <= 0 || typeof raf !== 'function') return false;

  raf(() => {
    raf(() => {
      const height = scroller.document?.documentElement?.scrollHeight ?? 0;
      const viewport = scroller.innerHeight ?? 0;
      if (height - viewport < top) return; // too short — stay at the top
      scroller.scrollTo?.({ top, behavior: 'instant' });
    });
  });
  return true;
}
