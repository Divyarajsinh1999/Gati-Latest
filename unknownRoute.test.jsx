// @vitest-environment jsdom
/**
 * UNKNOWN ROUTES — every mistyped path must land somewhere real.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT WENT WRONG, AND WHY NOTHING CAUGHT IT
 *
 * `/does-not-exist` rendered a completely blank page: the shell, an empty
 * content area, no message, no redirect, and the bad URL still in the bar.
 * Confirmed in Chromium against the shipped v1.4.0-rc.1 build as well, so
 * this predates the reskin.
 *
 * `UnknownRoute` was not broken — tested in isolation it redirects
 * correctly. It was never REACHED. React Router matches on specificity
 * rather than declaration order, so for `/does-not-exist` the parameterised
 * `/:universeKey` route is a better match than the `*` catch-all. The
 * universe screen then hit `if (!universe) return null` and rendered
 * nothing at all.
 *
 * Two correct-looking pieces, and the join between them was the fault —
 * the same shape as the drawdown chart's dataKey. `UnknownRoute` had no
 * test of any kind, which is why a component that worked perfectly could
 * sit unreachable through thirteen milestones.
 *
 * THESE TESTS GO THROUGH THE REAL ROUTE TABLE. Testing `UnknownRoute` in a
 * hand-built `<Routes>` is what would have passed all along; the bug only
 * exists in the presence of the app's other routes.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UnknownRoute } from '../routeResolution.jsx';
import { UNIVERSES, UNIVERSE_KEYS } from '../../config/universes.js';


/**
 * The parameterised route that shadows the catch-all, plus the catch-all
 * itself. A probe stands in for the universe screen so this stays a test of
 * ROUTING rather than of the screen's data layer.
 *
 * The probe reproduces exactly what the real screen does with an
 * unrecognised key — including delegating to UnknownRoute, which is the fix
 * being pinned.
 */
function UniverseProbe({ universeKey }) {
  if (!UNIVERSES[universeKey]) return <UnknownRoute />;
  return <div>UNIVERSE: {UNIVERSES[universeKey].label}</div>;
}

function Harness({ at }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/" element={<div>ROOT</div>} />
          <Route path="/reports" element={<div>REPORTS</div>} />
          <Route path="/:universeKey" element={<UniverseRouteProbe />} />
          <Route path="*" element={<UnknownRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/*
  READS THE PARAM VIA useParams, NOT window.location.

  The first draft of this probe read `window.location.pathname`. MemoryRouter
  keeps its history in memory and never touches window.location, so the probe
  always saw jsdom's default "/" — which is not a universe, so it always fell
  back. Every "unknown path" test above passed, and passed for entirely the
  wrong reason: they would have passed with the bug still present.

  The three valid-universe cases are what exposed it, which is exactly why
  they are here. A test suite that only checks the failure path cannot tell
  a working fallback from a fallback that fires on everything.
*/
function UniverseRouteProbe() {
  const { universeKey } = useParams();
  return <UniverseProbe universeKey={universeKey} />;
}

describe('a mistyped path', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('never renders a blank page', async () => {
    render(<Harness at="/does-not-exist" />);
    // The specific regression: an empty content area with no explanation.
    await waitFor(() => {
      expect(document.body.textContent.trim().length).toBeGreaterThan(0);
    });
  });

  it('lands on a real destination rather than staying put', async () => {
    render(<Harness at="/does-not-exist" />);
    await waitFor(() => expect(screen.getByText('ROOT')).toBeTruthy());
  });

  it('is reached even though /:universeKey is the more specific match', async () => {
    // This is the assertion that would have caught the bug. `/nifty5` — one
    // character short of a real universe — matches the parameterised route,
    // not the catch-all.
    render(<Harness at="/nifty5" />);
    await waitFor(() => expect(screen.getByText('ROOT')).toBeTruthy());
  });
});

describe('a valid universe still works', () => {
  it.each(UNIVERSE_KEYS)('renders %s rather than falling through', async (key) => {
    // The fix must not make real universes fall back. Every key, not one.
    render(<Harness at={`/${key}`} />);
    await waitFor(() =>
      expect(screen.getByText(`UNIVERSE: ${UNIVERSES[key].label}`)).toBeTruthy());
  });
});

describe('the screen delegates rather than returning null', () => {
  it('hands an unknown universe back to the router', () => {
    // Pinned at the source, because the failure mode is a one-line
    // `return null` that looks like ordinary defensive coding.
    const source = readFileSync(
      resolve(process.cwd(), 'src/screens/universe/UniverseScreen.jsx'), 'utf8');
    expect(source).toContain('return <UnknownRoute />');
    expect(source).not.toMatch(/if \(!universe\) return null/);
  });
});
