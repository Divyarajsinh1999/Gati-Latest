/**
 * ROUTES — the universe-first URL model.
 *
 * WHAT THIS OWNS
 *   Which component answers which URL.
 *
 * WHAT THIS MUST NEVER DO
 *   Leave a path unhandled. The catch-all resolves to the most specific valid
 *   destination and explains itself; a blank page is indistinguishable from a
 *   crash to the person looking at it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ROUTE ORDER MATTERS
 *
 *   /:universeKey/all      ┐
 *   /:universeKey/record   ├─ static segments, matched first
 *   /:universeKey/stock/*  ┘
 *   /:universeKey/:window  ← dynamic, matched last and validated
 *
 * React Router ranks static segments above dynamic ones, so `all` can never be
 * mistaken for a window. The validation in `parsePath` does not rely on that
 * ranking, so the behaviour stays correct and testable independently of the
 * router's internals.
 *
 * LAZY LOADING: Reports, Settings and Methodology are split out. None is
 * needed to paint the answer, and the universe screen is the only route that
 * matters to startup time.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.jsx';
import { UniverseScreen } from './screens/universe/UniverseScreen.jsx';

/**
 * Secondary screens are split out, so they never load before first paint.
 *
 * Measured: adding the universe screen while this page was still eagerly
 * imported pushed the index chunk from 35 kB to 54 kB gzipped, within 6 kB of
 * its budget — for a page most sessions never open. It also drags the charting
 * library into the first load, which is the one dependency the architecture
 * deliberately keeps out of the path to first paint.
 */
const StockDetailScreen = lazy(() => import('./screens/stock/StockDetailScreen.jsx').then((m) => ({ default: m.StockDetailScreen })));
const PortfolioScreen = lazy(() => import('./screens/portfolio/PortfolioScreen.jsx').then((m) => ({ default: m.PortfolioScreen })));
const ReportsScreen = lazy(() => import('./screens/reports/ReportsScreen.jsx').then((m) => ({ default: m.ReportsScreen })));
const SettingsScreen = lazy(() => import('./screens/settings/SettingsScreen.jsx').then((m) => ({ default: m.SettingsScreen })));
const HowItWorksScreen = lazy(() => import('./screens/howItWorks/HowItWorksScreen.jsx').then((m) => ({ default: m.HowItWorksScreen })));
const AboutScreen = lazy(() => import('./screens/about/AboutScreen.jsx').then((m) => ({ default: m.AboutScreen })));
const MethodologyScreen = lazy(() => import('./screens/methodology/MethodologyScreen.jsx').then((m) => ({ default: m.MethodologyScreen })));
const FullRankingScreen = lazy(() => import('./screens/ranking/FullRankingScreen.jsx').then((m) => ({ default: m.FullRankingScreen })));
const StrategyRecordScreen = lazy(() => import('./screens/record/StrategyRecordScreen.jsx').then((m) => ({ default: m.StrategyRecordScreen })));
import { RootRedirect, LegacyStrategyRedirect, UnknownRoute } from './navigation/routeResolution.jsx';

// Lazy, like every other non-universe screen: a directory nobody has opened
// yet has no business in the eager chunk.
const StrategiesScreen = lazy(() => import('./screens/StrategiesScreen.jsx'));
// Lazy, like every other non-universe screen: a journal nobody has opened has
// no business in the eager chunk.
const PaperLogScreen = lazy(() => import('./screens/PaperLogScreen.jsx'));


/** Development-only component gallery; branch-eliminated in production. */
const Gallery = import.meta.env.PROD ? null : lazy(() => import('./screens/gallery/Gallery.jsx'));

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Opens on the last universe used, not a fixed default. */}
        <Route path="/" element={<RootRedirect />} />

        {/* Universe and its sub-views. Static segments before the window. */}
        <Route path="/:universeKey" element={<UniverseScreen />} />
        <Route path="/:universeKey/all" element={<Suspense fallback={null}><FullRankingScreen /></Suspense>} />
        <Route path="/:universeKey/record" element={<Suspense fallback={null}><StrategyRecordScreen /></Suspense>} />
        <Route path="/:universeKey/stock/:symbol" element={<Suspense fallback={null}><StockDetailScreen /></Suspense>} />
        <Route path="/:universeKey/:window" element={<UniverseScreen />} />

        <Route path="/strategies" element={<Suspense fallback={null}><StrategiesScreen /></Suspense>} />
        <Route path="/paper-log" element={<Suspense fallback={null}><PaperLogScreen /></Suspense>} />
        <Route path="/reports" element={<Suspense fallback={null}><ReportsScreen /></Suspense>} />
        {/*
          Portfolio lives UNDER Reports rather than as a sixth destination.
          Navigation is capped at five (Phase 2 Part 5, reaffirmed in D15), and
          an optional feature does not earn a permanent slot.
        */}
        <Route path="/portfolio" element={<Suspense fallback={null}><PortfolioScreen /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={null}><SettingsScreen /></Suspense>} />
        <Route path="/how-it-works" element={<Suspense fallback={null}><HowItWorksScreen /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={null}><AboutScreen /></Suspense>} />
        <Route path="/methodology" element={<Suspense fallback={null}><MethodologyScreen /></Suspense>} />

        {/* Bookmarks and shared links from before the URL change. */}
        <Route path="/strategy/:strategyKey" element={<LegacyStrategyRedirect />} />

        {Gallery ? (
          <Route path="/_gallery" element={<Suspense fallback={null}><Gallery /></Suspense>} />
        ) : null}

        <Route path="*" element={<UnknownRoute />} />
      </Route>
    </Routes>
  );
}
