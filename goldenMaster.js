/**
 * GOLDEN MASTER — the primary defence against a silently-wrong number.
 *
 * WHAT THIS OWNS
 *   Loading a frozen expected result, comparing engine output against it, and
 *   failing loudly with a readable diff when a number moves.
 *
 * WHAT THIS MUST NEVER DO
 *   Auto-update on mismatch. The whole value of a golden master is that it
 *   makes a changed number IMPOSSIBLE TO SHIP ACCIDENTALLY. Updating requires
 *   an explicit environment flag and a recorded reason in DECISIONS.md.
 *
 * WHY THIS EXISTS
 *   Three financial bugs have already shipped in this project, each passing a
 *   full test suite: a mid-month self-comparison that collapsed the ranking to
 *   alphabetical order; a look-ahead in the calculator; and transaction costs
 *   that were unit-tested but wired to nothing. Every one of them was a
 *   CHANGED NUMBER that no assertion was watching. Unit tests prove a function
 *   is right in isolation; a golden master proves the SYSTEM still produces
 *   the same answer.
 *
 * TOLERANCE
 *   Comparison is exact to a fixed number of decimals, not epsilon-fuzzy.
 *   A "small" drift in a return is still a drift, and rounding to 6 decimals
 *   already absorbs genuine floating-point noise across platforms.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = join(HERE, '..', 'golden');
const DECIMALS = 6;

/** Set GOLDEN_UPDATE=1 to rewrite snapshots. Never set this in CI. */
const UPDATE = process.env.GOLDEN_UPDATE === '1';

/**
 * Compare a value against its frozen snapshot.
 *
 * @param {string} name stable snapshot name, e.g. 'backtest-nifty50-1m'
 * @param {unknown} actual
 * @returns {{ ok: boolean, message: string }}
 */
export function compareGolden(name, actual) {
  const file = join(SNAPSHOT_DIR, `${name}.json`);
  const normalised = normalise(actual);

  if (UPDATE || !existsSync(file)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify(normalised, null, 2) + '\n', 'utf8');
    return {
      ok: true,
      message: existsSync(file) ? `golden master written: ${name}` : `golden master created: ${name}`,
    };
  }

  const expected = JSON.parse(readFileSync(file, 'utf8'));
  const diffs = diff(expected, normalised, '');

  if (diffs.length === 0) return { ok: true, message: 'match' };

  const shown = diffs.slice(0, 12).map((d) => `  ${d}`).join('\n');
  const more = diffs.length > 12 ? `\n  …and ${diffs.length - 12} more` : '';
  return {
    ok: false,
    message:
      `GOLDEN MASTER MISMATCH — "${name}" produced ${diffs.length} changed value(s).\n\n` +
      `${shown}${more}\n\n` +
      `A number changed. That is either a bug, or a deliberate change that must be\n` +
      `recorded in DECISIONS.md with a before/after before the snapshot is updated.\n` +
      `To update deliberately:  GOLDEN_UPDATE=1 npm test`,
  };
}

/**
 * Round every number to a fixed precision and sort object keys, so a snapshot
 * is stable across platforms and insertion order.
 */
function normalise(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    return Number(value.toFixed(DECIMALS));
  }
  if (Array.isArray(value)) return value.map(normalise);
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].sort(byKey).map(([k, v]) => [k, normalise(v)]));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(byKey).map(([k, v]) => [k, normalise(v)]));
  }
  return value;
}

function byKey(a, b) {
  return String(a[0]).localeCompare(String(b[0]));
}

/** Depth-first structural diff producing human-readable paths. */
function diff(expected, actual, path) {
  const out = [];
  if (typeof expected !== typeof actual || Array.isArray(expected) !== Array.isArray(actual)) {
    out.push(`${path || '<root>'}: type ${typeName(expected)} → ${typeName(actual)}`);
    return out;
  }
  if (expected === null || typeof expected !== 'object') {
    if (expected !== actual) out.push(`${path || '<root>'}: ${JSON.stringify(expected)} → ${JSON.stringify(actual)}`);
    return out;
  }
  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) out.push(`${path}: length ${expected.length} → ${actual.length}`);
    const n = Math.min(expected.length, actual.length);
    for (let i = 0; i < n; i++) out.push(...diff(expected[i], actual[i], `${path}[${i}]`));
    return out;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const k of keys) {
    const p = path ? `${path}.${k}` : k;
    if (!(k in expected)) out.push(`${p}: added (${JSON.stringify(actual[k])})`);
    else if (!(k in actual)) out.push(`${p}: removed (was ${JSON.stringify(expected[k])})`);
    else out.push(...diff(expected[k], actual[k], p));
  }
  return out;
}

function typeName(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
