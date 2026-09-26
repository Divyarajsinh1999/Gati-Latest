// @vitest-environment jsdom
/**
 * SPLASH SCREEN — behaviour, not appearance.
 *
 * WHAT THESE CATCH
 *   The splash outliving its timers, the splash blocking the app, the
 *   splash surviving a failed asset load, and the browser chrome colour
 *   being left on the splash's dark value after the splash has gone.
 *
 * WHAT THESE CANNOT CATCH
 *   Whether it looks right. jsdom computes no layout, runs no compositor
 *   and honours no mask, so the sweep is verified as geometry in
 *   config/__tests__/splash.test.js and as a picture only on a real device.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { SplashScreen } from '../layout/SplashScreen.jsx';
import {
  SPLASH_TIMING,
  SPLASH_LOGO_SRC,
  SPLASH_BACKGROUND,
  splashTotalDuration,
  splashFadeStart,
} from '../../config/splash.js';
import { THEME_COLOR, THEME_STORAGE_KEY } from '../../utils/theme.js';

/** Stands in for window.matchMedia, which jsdom does not implement. */
function stubMatchMedia({ reducedMotion = false, darkSystem = false } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('reduced-motion') ? reducedMotion : darkSystem,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/** Recreates what index.html's inline bootstrap does before React runs. */
function bootstrapDocument() {
  document.head.innerHTML = `<meta name="theme-color" content="${SPLASH_BACKGROUND}" />`;
  document.documentElement.setAttribute('data-splash', 'active');
  document.documentElement.setAttribute('data-theme', 'light');
}

const themeColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
const splash = () => document.querySelector('.gati-splash');

beforeEach(() => {
  vi.useFakeTimers();
  stubMatchMedia();
  bootstrapDocument();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe('the splash plays and then leaves', () => {
  it('renders the mark on mount', () => {
    render(<SplashScreen />);
    const images = screen.getAllByRole('presentation', { hidden: true });
    expect(images.length).toBeGreaterThan(0);
    expect(document.querySelectorAll(`img[src="${SPLASH_LOGO_SRC}"]`).length).toBe(2);
  });

  it('starts its fade at the scheduled moment, not before', () => {
    render(<SplashScreen />);
    act(() => vi.advanceTimersByTime(splashFadeStart(SPLASH_TIMING) - 20));
    expect(splash()?.className).not.toContain('gati-splash--leaving');

    act(() => vi.advanceTimersByTime(40));
    expect(splash()?.className).toContain('gati-splash--leaving');
  });

  it('unmounts completely once the sequence is over', () => {
    render(<SplashScreen />);
    act(() => vi.advanceTimersByTime(splashTotalDuration(SPLASH_TIMING) + 50));
    expect(splash()).toBeNull();
  });

  /**
   * The splash is decorative and covers the whole viewport. Left announced,
   * it would put a wall of nothing between a screen-reader user and content
   * that is already in the DOM underneath it.
   */
  it('is hidden from assistive technology throughout', () => {
    render(<SplashScreen />);
    expect(splash()?.getAttribute('aria-hidden')).toBe('true');
    expect(splash()?.querySelector('button, a, input, [tabindex]')).toBeNull();
  });
});

describe('browser chrome colour', () => {
  it('is left on the splash colour while the splash is still visible', () => {
    render(<SplashScreen />);
    act(() => vi.advanceTimersByTime(splashFadeStart(SPLASH_TIMING) + 10));
    // Mid-fade. Restoring here would show the seam the bootstrap prevents.
    expect(themeColor()).toBe(SPLASH_BACKGROUND);
  });

  /*
    RETARGETED IN M14 (D19). These asserted THEME_COLOR.light because light
    used to be what an unconfigured launch resolved to. Dark is the default
    now, so the literal was standing in for "the default", and reading it
    that way would have made the test pass for the wrong reason.

    Both sides are now covered explicitly — light via a STORED preference,
    dark via the default — so neither depends on which one happens to be the
    default, and a future flip of that default breaks neither.
  */
  it('returns to the theme value once the splash is gone', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<SplashScreen />);
    act(() => vi.advanceTimersByTime(splashTotalDuration(SPLASH_TIMING) + 50));
    expect(themeColor()).toBe(THEME_COLOR.light);
    expect(document.documentElement.hasAttribute('data-splash')).toBe(false);
  });

  it('restores the dark chrome colour on an unconfigured launch', () => {
    // No stored preference and the OS reporting light: dark is still correct,
    // because dark is the app's default rather than a mirror of the system.
    stubMatchMedia({ darkSystem: false });
    render(<SplashScreen />);
    act(() => vi.advanceTimersByTime(splashTotalDuration(SPLASH_TIMING) + 50));
    expect(themeColor()).toBe(THEME_COLOR.dark);
  });

  it('returns to the dark theme value for a dark-mode launch', () => {
    stubMatchMedia({ darkSystem: true });
    render(<SplashScreen />);
    act(() => vi.advanceTimersByTime(splashTotalDuration(SPLASH_TIMING) + 50));
    expect(themeColor()).toBe(THEME_COLOR.dark);
  });
});

describe('a failed asset does not hold the app hostage', () => {
  /**
   * A splash that cannot draw its logo is an empty dark rectangle sitting
   * on the app for two seconds. Worse than no splash at all.
   */
  it('gets out of the way immediately when the logo fails to load', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<SplashScreen />);
    const logo = document.querySelector(`img[src="${SPLASH_LOGO_SRC}"]`);

    act(() => {
      fireEvent.error(logo);
    });

    expect(splash()).toBeNull();
    expect(document.documentElement.hasAttribute('data-splash')).toBe(false);
    expect(themeColor()).toBe(THEME_COLOR.light);
  });
});

describe('skipping', () => {
  it('fades rather than cutting when dismissed early', () => {
    render(<SplashScreen />);
    act(() => vi.advanceTimersByTime(200));

    act(() => {
      fireEvent.click(splash());
    });
    // Still mounted, now leaving — a cut would remove it on this frame.
    expect(splash()?.className).toContain('gati-splash--leaving');

    act(() => vi.advanceTimersByTime(SPLASH_TIMING.fadeOut + 20));
    expect(splash()).toBeNull();
  });

  it('ignores a second dismissal instead of restarting the fade', () => {
    render(<SplashScreen />);
    act(() => vi.advanceTimersByTime(200));
    act(() => fireEvent.click(splash()));
    act(() => vi.advanceTimersByTime(SPLASH_TIMING.fadeOut / 2));
    act(() => fireEvent.click(splash()));
    act(() => vi.advanceTimersByTime(SPLASH_TIMING.fadeOut));
    expect(splash()).toBeNull();
  });
});

describe('reduced motion', () => {
  beforeEach(() => stubMatchMedia({ reducedMotion: true }));

  it('takes the still path and is over far sooner', () => {
    render(<SplashScreen />);
    expect(splash()?.className).toContain('gati-splash--still');

    act(() => vi.advanceTimersByTime(splashTotalDuration(SPLASH_TIMING)));
    expect(splash()).toBeNull();
  });

  it('still restores the chrome colour, so the still path is not a dead end', () => {
    // Stored light, so this asserts the RESTORE happened rather than passing
    // because the splash colour and the dark canvas are both near-black.
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<SplashScreen />);
    act(() => vi.advanceTimersByTime(splashTotalDuration(SPLASH_TIMING)));
    expect(themeColor()).toBe(THEME_COLOR.light);
  });
});

describe('timers', () => {
  it('leaves none pending after unmount', () => {
    const { unmount } = render(<SplashScreen />);
    act(() => vi.advanceTimersByTime(100));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
