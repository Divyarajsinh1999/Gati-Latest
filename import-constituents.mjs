#!/usr/bin/env node
/**
 * Constituent-list importer.
 *
 * Converts index constituent data into the `stocks: [...]` arrays used by
 * `src/config/universes.js`. Kept in the repo so the lists are reproducible
 * rather than hand-pasted, and so re-running after a semi-annual NSE
 * reconstitution is a single command.
 *
 * USAGE
 *   node scripts/import-constituents.mjs <midsmallcap400.json> <smallcap250.json>
 *
 * Nifty Midcap 150 is DERIVED as (MidSmallcap 400 − Smallcap 250). That
 * identity holds by index construction, and the script asserts it produces
 * exactly 150 names — which doubles as a strong integrity check on both
 * inputs: corrupt or stale data will almost never satisfy it.
 *
 * Input format (array of objects):
 *   [{ "sym": "RHIM.NS", "name": "RHI MAGNESITA INDIA LTD.", "sector": "Capital Goods" }]
 *
 * A CSV from niftyindices.com can be converted to this shape first; see
 * import-constituents.md.
 *
 * The script REFUSES to emit anything if any invariant fails, so a bad
 * import can't silently produce a plausible-looking but wrong universe.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const [midSmallPath, smallPath] = process.argv.slice(2);
if (!midSmallPath || !smallPath) {
  console.error('Usage: node scripts/import-constituents.mjs <midsmallcap400.json> <smallcap250.json>');
  process.exit(1);
}

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

/**
 * Title-cases ALL-CAPS company names; leaves mixed-case names alone.
 *
 * Acronyms are the tricky part — naive title-casing turns "BSE" into "Bse"
 * and "RHI MAGNESITA" into "Rhi Magnesita". Short all-letter tokens are
 * therefore preserved as-is, except for a small list of ordinary words that
 * merely happen to be short (LTD, INDIA, THE...), which do get title-cased.
 */
const LOWERCASE_WORDS = new Set(['OF', 'AND', 'THE', 'DE']);
const TITLE_WORDS = new Set([
  'LTD', 'LTD.', 'LIMITED', 'INDIA', 'CO', 'CO.', 'CORP', 'CORP.', 'INC', 'PVT',
  'BANK', 'AUTO', 'GAS', 'OIL', 'IRON', 'ZINC', 'COAL', 'FOOD', 'PORT', 'CITY', 'NEW', 'SUN', 'TATA',
]);

function normalizeName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return name;

  const letters = name.replace(/[^A-Za-z]/g, '');
  const isAllCaps = letters.length > 0 && letters === letters.toUpperCase();
  if (!isAllCaps) return name;

  // A single ALL-CAPS token is almost always an acronym or a brand written
  // that way on purpose (CRISIL, RITES, H.E.G.). Title-casing those does
  // more harm than good, so leave them exactly as the source has them.
  if (!name.includes(' ')) return name;

  return name
    .split(' ')
    .map((token, index) => {
      const bare = token.replace(/[^A-Za-z.]/g, '');
      const upper = bare.toUpperCase();

      if (index > 0 && LOWERCASE_WORDS.has(upper)) return upper.toLowerCase();
      if (TITLE_WORDS.has(upper)) {
        const t = token.toLowerCase().replace(/\.$/, '');
        return t.charAt(0).toUpperCase() + t.slice(1);
      }
      // Short all-letter token that isn't an ordinary word: treat as an acronym.
      if (/^[A-Z]{1,4}\.?$/.test(token)) return token.replace(/\.$/, '');
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/\.$/, '')
    .trim();
}

/** Aligns sector wording with the style already used for the NIFTY 50 entries. */
const normalizeSector = (s) => String(s ?? '').replace(/\s+and\s+/gi, ' & ').replace(/\s+/g, ' ').trim();

const TICKER = /^[A-Z0-9&-]+\.NS$/;

function validate(label, rows, expected) {
  const problems = [];
  if (rows.length !== expected) problems.push(`expected ${expected} rows, got ${rows.length}`);
  const syms = rows.map((r) => r.sym);
  const dupes = syms.filter((s, i) => syms.indexOf(s) !== i);
  if (dupes.length) problems.push(`duplicate symbols: ${[...new Set(dupes)].join(', ')}`);
  const malformed = syms.filter((s) => !TICKER.test(s));
  if (malformed.length) problems.push(`malformed tickers: ${malformed.slice(0, 5).join(', ')}`);
  const nameless = rows.filter((r) => !String(r.name ?? '').trim());
  if (nameless.length) problems.push(`${nameless.length} rows missing a name`);
  if (problems.length) {
    console.error(`FAIL ${label}:`);
    for (const p of problems) console.error(`  - ${p}`);
    return false;
  }
  console.log(`  OK ${label}: ${rows.length} constituents`);
  return true;
}

const midSmall = read(midSmallPath);
const small = read(smallPath);

console.log('Validating inputs...');
let ok = validate('MidSmallcap 400', midSmall, 400) & validate('Smallcap 250', small, 250);

const smallSet = new Set(small.map((r) => r.sym));
const derivedMid = midSmall.filter((r) => !smallSet.has(r.sym));

console.log('Deriving Midcap 150 = MidSmallcap 400 - Smallcap 250 ...');
ok = validate('Midcap 150 (derived)', derivedMid, 150) & ok;

const containment = [...smallSet].filter((s) => !midSmall.some((r) => r.sym === s));
if (containment.length) {
  console.error(`FAIL: ${containment.length} Smallcap 250 symbols are absent from MidSmallcap 400`);
  ok = false;
}

const overlap = derivedMid.filter((r) => smallSet.has(r.sym));
if (overlap.length) {
  console.error(`FAIL: derived Midcap 150 overlaps Smallcap 250 (${overlap.length} symbols)`);
  ok = false;
}

if (!ok) {
  console.error('\nRefusing to emit config: one or more integrity checks failed.');
  process.exit(1);
}

const toEntry = (r) =>
  `      { symbol: '${r.sym}', name: ${JSON.stringify(normalizeName(r.name))}, sector: ${JSON.stringify(normalizeSector(r.sector))} },`;

const emit = (rows) => rows.map(toEntry).join('\n');

const out = `// Generated by scripts/import-constituents.mjs — do not edit by hand.
// Regenerate after each NSE semi-annual reconstitution.

export const MIDCAP150_STOCKS = [
${emit(derivedMid)}
];

export const SMALLCAP250_STOCKS = [
${emit(small)}
];
`;

const target = new URL('../src/config/constituents.generated.js', import.meta.url);
writeFileSync(target, out);
console.log(`\nAll integrity checks passed. Wrote ${derivedMid.length} + ${small.length} constituents to`);
console.log(`  src/config/constituents.generated.js`);
