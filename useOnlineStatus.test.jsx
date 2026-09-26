// @vitest-environment jsdom
/**
 * ONLINE STATUS TESTS.
 *
 * Written because `OfflineState` existed from M4 and was reachable only in the
 * dev gallery — nothing in the product ever detected offline, despite Phase 2
 * specifying it as a designed state. A component that renders correctly but is
 * never reached is indistinguishable from one that does not exist.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { useOnlineStatus } from '../useOnlineStatus.js';

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

function Probe() {
  return <span data-testid="status">{useOnlineStatus() ? 'online' : 'offline'}</span>;
}

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

describe('useOnlineStatus', () => {
  it('reports online when the device is online', () => {
    setOnline(true);
    render(<Probe />);
    expect(screen.getByTestId('status').textContent).toBe('online');
  });

  it('reports offline when the device is offline', () => {
    setOnline(false);
    render(<Probe />);
    expect(screen.getByTestId('status').textContent).toBe('offline');
  });

  it('reacts to losing and regaining the network', () => {
    setOnline(true);
    render(<Probe />);

    act(() => {
      setOnline(false);
      globalThis.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('status').textContent).toBe('offline');

    act(() => {
      setOnline(true);
      globalThis.dispatchEvent(new Event('online'));
    });
    expect(screen.getByTestId('status').textContent).toBe('online');
  });

  it('DEFAULTS TO ONLINE when it cannot tell', () => {
    // Assuming offline would show an offline screen to someone who is not
    // offline — confidently wrong, and it hides whatever actually failed.
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: undefined });
    render(<Probe />);
    expect(screen.getByTestId('status').textContent).toBe('online');
  });
});
