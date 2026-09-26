/**
 * ARCHITECTURE TESTS — do the layer boundaries actually fail the build?
 *
 * WHAT THIS OWNS
 *   Proof that the import restrictions in eslint.config.js are real. A lint
 *   rule that is configured but never fires is worse than no rule: it creates
 *   confidence without enforcement.
 *
 * WHAT THIS MUST NEVER DO
 *   Assert on rule TEXT. These tests check that a violation is REJECTED and
 *   that legitimate code is ACCEPTED. Wording is free to change.
 *
 * WHY THIS IS A TEST AND NOT A CHECKLIST ITEM
 *   The milestone's definition of done says "a deliberately-introduced layer
 *   violation fails the build". Anyone can claim that. This runs it.
 */

import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: process.cwd() });

/**
 * Lint a hypothetical file at a given path without writing it to disk.
 * `filePath` decides which config block applies, which is the whole point.
 */
async function lintAs(filePath, code) {
  const results = await eslint.lintText(code, { filePath, warnIgnored: false });
  const messages = results.flatMap((r) => r.messages);
  return {
    errors: messages.filter((m) => m.severity === 2),
    boundaryErrors: messages.filter((m) => m.ruleId === 'no-restricted-imports'),
  };
}

describe('engine purity', () => {
  it('rejects React in an engine', async () => {
    const { boundaryErrors } = await lintAs(
      'src/engine/probe.js',
      `import { useMemo } from 'react';\nexport const x = useMemo;\n`,
    );
    expect(boundaryErrors.length).toBeGreaterThan(0);
  });

  it('rejects the data layer in an engine', async () => {
    const { boundaryErrors } = await lintAs(
      'src/engine/probe.js',
      `import { fetchUniverseBundle } from '../data/dataService.js';\nexport const x = fetchUniverseBundle;\n`,
    );
    expect(boundaryErrors.length).toBeGreaterThan(0);
  });

  it('rejects hooks and UI in an engine', async () => {
    const { boundaryErrors } = await lintAs(
      'src/engine/probe.js',
      `import { useUniverseData } from '../hooks/useUniverseData.js';
       import { RankingTable } from '../components/tables/RankingTable.jsx';
       export const x = [useUniverseData, RankingTable];\n`,
    );
    expect(boundaryErrors.length).toBeGreaterThanOrEqual(2);
  });

  it('ALLOWS config and sibling engines — the legitimate dependencies', async () => {
    const { boundaryErrors } = await lintAs(
      'src/engine/probe.js',
      `import { TOP_N } from '../config/constants.js';
       import { rankByRS } from './ranking.js';
       export const x = [TOP_N, rankByRS];\n`,
    );
    expect(boundaryErrors).toHaveLength(0);
  });
});

describe('config is a dependency-free leaf', () => {
  it('rejects an engine import from config', async () => {
    const { boundaryErrors } = await lintAs(
      'src/config/probe.js',
      `import { calculateRS } from '../engine/momentum.js';\nexport const x = calculateRS;\n`,
    );
    expect(boundaryErrors.length).toBeGreaterThan(0);
  });

  it('ALLOWS config importing config', async () => {
    const { boundaryErrors } = await lintAs(
      'src/config/probe.js',
      `import { UNIVERSES } from './universes.js';\nexport const x = UNIVERSES;\n`,
    );
    expect(boundaryErrors).toHaveLength(0);
  });
});

describe('data layer holds no domain knowledge', () => {
  it('rejects an engine import from the data layer', async () => {
    const { boundaryErrors } = await lintAs(
      'src/data/probe.js',
      `import { runBacktest } from '../engine/backtestEngine.js';\nexport const x = runBacktest;\n`,
    );
    expect(boundaryErrors.length).toBeGreaterThan(0);
  });

  it('ALLOWS config and providers — how the data layer actually works', async () => {
    const { boundaryErrors } = await lintAs(
      'src/data/probe.js',
      `import { DATA_START_DATE } from '../config/constants.js';
       import { MarketDataProvider } from './providers/MarketDataProvider.js';
       export const x = [DATA_START_DATE, MarketDataProvider];\n`,
    );
    expect(boundaryErrors).toHaveLength(0);
  });
});

describe('pre-armed boundaries for folders that do not exist yet', () => {
  // These rules are configured now so the boundary holds from the FIRST file
  // placed in screens/ or selectors/, rather than being retrofitted after the
  // violations already exist and have become load-bearing.

  it('rejects an engine import from a screen', async () => {
    const { boundaryErrors } = await lintAs(
      'src/screens/universe/probe.jsx',
      `import { calculateRS } from '../../engine/momentum.js';\nexport const x = calculateRS;\n`,
    );
    expect(boundaryErrors.length).toBeGreaterThan(0);
  });

  it('rejects a direct data import from a screen', async () => {
    const { boundaryErrors } = await lintAs(
      'src/screens/universe/probe.jsx',
      `import { fetchUniverseBundle } from '../../data/dataService.js';\nexport const x = fetchUniverseBundle;\n`,
    );
    expect(boundaryErrors.length).toBeGreaterThan(0);
  });

  it('rejects React inside a selector', async () => {
    const { boundaryErrors } = await lintAs(
      'src/selectors/probe.js',
      `import { useMemo } from 'react';\nexport const x = useMemo;\n`,
    );
    expect(boundaryErrors.length).toBeGreaterThan(0);
  });

  it('ALLOWS a selector reading engine output — that is its job', async () => {
    const { boundaryErrors } = await lintAs(
      'src/selectors/probe.js',
      `import { selectTopN } from '../engine/ranking.js';\nexport const x = selectTopN;\n`,
    );
    expect(boundaryErrors).toHaveLength(0);
  });
});
