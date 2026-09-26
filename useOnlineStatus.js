/**
 * ONLINE STATUS — is the network reachable right now?
 *
 * WHAT THIS OWNS
 *   Reporting connectivity, and re-reporting it when it changes.
 *
 * WHAT THIS MUST NEVER DO
 *   Claim more certainty than it has. `navigator.onLine` reports whether the
 *   device has a network interface, NOT whether Yahoo is reachable — a captive
 *   portal or a dead upstream both read as "online". So this answers "is there
 *   definitely no network", which is a narrower and honest question. A fetch
 *   failure while apparently online is handled where it happens, as a data
 *   error, because that is what it is.
 *
 * WHY IT DEFAULTS TO ONLINE
 *   In an environment with no `navigator` (tests, SSR), assuming online means
 *   the app behaves normally and any real failure surfaces as a data error
 *   with its own explanation. Assuming offline would show an offline screen to
 *   someone who is not offline, which is worse: it is confidently wrong, and
 *   it hides whatever actually went wrong.
 */

import { useState, useEffect } from 'react';

function readOnline() {
  try {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  } catch {
    return true;
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(readOnline);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    globalThis.addEventListener?.('online', online);
    globalThis.addEventListener?.('offline', offline);
    return () => {
      globalThis.removeEventListener?.('online', online);
      globalThis.removeEventListener?.('offline', offline);
    };
  }, []);

  return isOnline;
}
