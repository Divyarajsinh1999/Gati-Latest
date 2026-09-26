/**
 * BUNDLE SIZE GATE — fails the build when a chunk outgrows its budget.
 *
 * WHAT THIS OWNS
 *   Measuring the gzipped size of every emitted JS chunk and comparing it
 *   against perf-budgets.json.
 *
 * WHAT THIS MUST NEVER DO
 *   Pass silently when it cannot find the build. A gate that can't find its
 *   input and returns success is a gate that has been disabled by accident,
 *   which is the most common way a size budget stops working.
 *
 * WHY GZIPPED AND PER-CHUNK
 *   Gzipped is what the user actually downloads. Per-chunk matters because the
 *   architecture deliberately splits charts out: it is the largest dependency
 *   and is not needed to paint the answer, so the number that governs
 *   first-paint is the INITIAL payload excluding it. A single total would let
 *   the charts chunk grow unnoticed, or let the initial bundle absorb charts
 *   and still look acceptable.
 *
 * Usage:  node scripts/check-bundle-size.mjs [--json]
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = new URL('../dist/assets', import.meta.url).pathname;
const budgets = JSON.parse(readFileSync(new URL('../perf-budgets.json', import.meta.url), 'utf8'));
const asJson = process.argv.includes('--json');

if (!existsSync(DIST)) {
  console.error(`  Cannot find ${DIST}. Run "npm run build" before the size gate.`);
  process.exit(1);
}

const files = readdirSync(DIST).filter((f) => f.endsWith('.js'));
if (files.length === 0) {
  console.error('  No JS chunks found in dist/assets — the build produced nothing to measure.');
  process.exit(1);
}

/**
 * Map a hashed filename back to its logical chunk name.
 *
 *   index-F9t__v-X.js  →  index
 *
 * The hash is a FIXED-LENGTH base64url string and may contain BOTH `-` and
 * `_`. An earlier version stripped only `[A-Za-z0-9_]+`, so a hash containing
 * a hyphen left "index-F9t__v" behind — which then failed the eager-chunk
 * lookup and reported a 44 kB eager chunk as lazily loaded, understating the
 * initial payload by more than a third.
 *
 * Anchoring on the hash LENGTH rather than its character set is what makes
 * this robust: chunk names may contain hyphens too, and only the last
 * fixed-width segment is ever the hash.
 */
const HASH_LENGTH = 8;

function chunkName(file) {
  const stripped = file.replace(/\.js$/, '');
  const cut = stripped.length - (HASH_LENGTH + 1);
  if (cut > 0 && stripped[cut] === '-') return stripped.slice(0, cut);
  return stripped;
}

const measured = files
  .map((file) => {
    const raw = readFileSync(join(DIST, file));
    return {
      file,
      chunk: chunkName(file),
      rawKb: round1(statSync(join(DIST, file)).size / 1024),
      gzipKb: round1(gzipSync(raw).length / 1024),
    };
  })
  .sort((a, b) => b.gzipKb - a.gzipKb);

const failures = [];

for (const m of measured) {
  const budget = budgets.bundle.chunks[m.chunk];
  m.budgetKb = budget ?? null;
  m.pass = budget == null ? true : m.gzipKb <= budget;
  if (!m.pass) failures.push(m);
}

// The initial payload is only what the browser needs BEFORE IT CAN PAINT.
//
// Declared explicitly rather than inferred by excluding known-lazy names: with
// an exclusion list, every new lazily-loaded route would silently inflate this
// figure and look like a regression, which is precisely backwards — splitting
// a route out is an improvement.
const eager = new Set(budgets.bundle.eagerChunks ?? ['index', 'vendor']);
const initialGzipKb = round1(
  measured.filter((m) => eager.has(m.chunk)).reduce((sum, m) => sum + m.gzipKb, 0),
);
const initialPass = initialGzipKb <= budgets.bundle.initialKbGzip;

if (asJson) {
  console.log(JSON.stringify({ chunks: measured, initialGzipKb, initialPass }, null, 2));
} else {
  console.log('');
  console.log('  BUNDLE SIZE (gzipped)');
  console.log('  ' + '─'.repeat(58));
  console.log('  chunk          raw        gzip       budget     verdict');
  console.log('  ' + '─'.repeat(58));
  for (const m of measured) {
    console.log(
      '  ' +
        m.chunk.padEnd(15) +
        `${m.rawKb}kB`.padEnd(11) +
        `${m.gzipKb}kB`.padEnd(11) +
        (m.budgetKb == null ? '—'.padEnd(11) : `${m.budgetKb}kB`.padEnd(11)) +
        (m.budgetKb == null ? (eager.has(m.chunk) ? 'unbudgeted' : 'lazy') : m.pass ? 'PASS' : 'FAIL'),
    );
  }
  console.log('  ' + '─'.repeat(58));
  console.log(
    `  initial payload (eager chunks only): ${initialGzipKb}kB gzip / ` +
      `${budgets.bundle.initialKbGzip}kB budget  ${initialPass ? 'PASS' : 'FAIL'}`,
  );
  console.log('');
}

if (failures.length > 0 || !initialPass) {
  console.error('  BUNDLE BUDGET BREACHED. Split, lazy-load, or justify and raise the budget deliberately.\n');
  process.exit(1);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
