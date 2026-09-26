/**
 * CACHE CONTROLS — the data layer's maintenance actions, exposed to the UI.
 *
 * WHAT THIS OWNS
 *   Clearing locally cached price data, and reporting how much is held.
 *
 * WHY THIS HOOK EXISTS AT ALL
 *   Settings needs a "clear cache" button, and the layer boundary forbids a
 *   screen importing the data layer directly — correctly. A screen that can
 *   reach into storage can also reach into fetching, and the rule that keeps
 *   financial calculation out of components is the same rule.
 *
 *   Hooks are the sanctioned crossing point: they may know about both.
 */

import { useState, useCallback } from 'react';
import { barStore } from '../data/cache/barStore.js';

export function useCacheControls() {
  const [status, setStatus] = useState('idle');
  const [usage, setUsage] = useState(null);

  const clear = useCallback(async () => {
    setStatus('clearing');
    try {
      await barStore.clear();
      setStatus('cleared');
    } catch {
      // Clearing a cache is not worth an error screen: the data is
      // re-fetchable and the app keeps working either way.
      setStatus('failed');
    }
  }, []);

  const measure = useCallback(async () => {
    setUsage(await barStore.usage());
  }, []);

  return { status, usage, clear, measure, isDegraded: barStore.isDegraded() };
}
