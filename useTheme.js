import { useCallback, useEffect, useState } from 'react';
import {
  DARK_MEDIA_QUERY,
  applyTheme,
  readStoredPreference,
  resolveTheme,
  writeStoredPreference,
} from '../utils/theme.js';

/**
 * Theme preference, as three states: light / dark / system.
 *
 * This hook deliberately does NOT decide the theme on mount — the inline
 * script in index.html already did that before first paint, and re-deciding
 * here would mean the first React render could disagree with what's on
 * screen. It reads the stored preference and keeps it in step from then on.
 *
 * The 'system' case is the reason this is a hook rather than a constant:
 * the OS can flip to dark on a schedule while the app is open, and a user
 * who chose "system" means "follow it", not "follow it once at load". The
 * media-query listener is what delivers that.
 */
export function useTheme() {
  const [preference, setPreferenceState] = useState(() => readStoredPreference());

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(DARK_MEDIA_QUERY).matches;
  });

  // Follow the OS while mounted. Only meaningful when preference is
  // 'system', but the listener is cheap and unconditional listeners avoid
  // a subscribe/unsubscribe cycle every time the user toggles.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(DARK_MEDIA_QUERY);
    const onChange = (event) => setSystemPrefersDark(event.matches);
    // addListener is the Safari <14 spelling; still worth the fallback.
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, []);

  const theme = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    writeStoredPreference(next);
  }, []);

  return { preference, theme, setPreference };
}
