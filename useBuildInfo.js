/**
 * WHICH BUILD IS ACTUALLY RUNNING?
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 *
 * A release shipped where every change was verifiably present in the
 * bundle and none of it appeared in the deployed app. The cause could have
 * been a deploy that did not take, or a service worker serving the old
 * cached shell — and there was no way to tell the two apart from inside the
 * app, because nothing displayed which build was running.
 *
 * This compares the version COMPILED INTO the running code against the
 * version the SERVER is currently serving at /version.json. Those two
 * disagreeing is the precise signature of a stale service worker: the
 * network has the new build, the client is running the old one.
 *
 * `cache: 'no-store'` and the precache exclusion together guarantee the
 * fetch reaches the network. A cached answer here would report the build
 * that installed the worker, which is the one answer that helps nobody.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';

/** Compiled in at build time — see buildStamp() in vite.config.js. */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
export const BUILD_TIME = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : null;

/**
 * @returns {{
 *   running: string,
 *   builtAt: string|null,
 *   served: string|null,
 *   isStale: boolean,
 *   checked: boolean,
 *   reload: () => void,
 * }}
 */
export function useBuildInfo() {
  const [served, setServed] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Query string as well as no-store: some proxies and older service
    // worker strategies honour one but not the other.
    fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.version) setServed(data.version);
      })
      .catch(() => {
        // Offline, or the file is not deployed. Neither is an error worth
        // showing — the absence of an answer is not evidence of staleness.
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Clears every cache and unregisters every service worker, then reloads.
   *
   * Heavier than location.reload(), and deliberately so: a plain reload is
   * answered by the same stale worker that caused the problem. This removes
   * the thing doing the serving before asking again.
   */
  const reload = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } finally {
      window.location.reload(true);
    }
  };

  return {
    running: APP_VERSION,
    builtAt: BUILD_TIME,
    served,
    // Only a POSITIVE mismatch counts. A failed fetch leaves `served` null,
    // and unknown must never be reported as stale.
    isStale: served != null && served !== APP_VERSION,
    checked,
    reload,
  };
}
