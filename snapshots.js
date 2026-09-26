/**
 * MONTH-END SNAPSHOTS — the immutability guarantee (decision D7).
 *
 * WHAT THIS OWNS
 *   Freezing what a completed month-end ranking actually showed, and comparing
 *   a fresh computation against that frozen record.
 *
 * WHAT THIS MUST NEVER DO
 *   Silently overwrite. When a stored month and a fresh computation disagree,
 *   that disagreement is the finding.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE PROBLEM THIS SOLVES
 *
 * Yahoo rewrites `adjClose` RETROACTIVELY on every split, bonus and dividend.
 * That is correct behaviour on their part — an adjusted series has to be
 * adjusted all the way back — but it means a backtest run today and the same
 * backtest run after a corporate action will legitimately disagree about
 * March 2025, with nothing anywhere saying so.
 *
 * A user who noted last month's figures and returns to find them changed has
 * no way to tell a data correction from a bug in the app. Since the entire
 * product rests on the claim that its numbers are checkable, an unexplained
 * change is the single thing most likely to end that trust — and the careful
 * user, the one who writes numbers down, is exactly who notices.
 *
 * So: compare, and name the month and the likely cause. The decision was
 * taken knowing it means occasional notes about months thought settled.
 * That is the point, not a side effect.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * WHAT IS COMPARED, AND WHY IT IS DELIBERATELY NARROW
 *   Only the Top N picks and their RS values. Comparing the full ranking of a
 *   250-stock universe would flag a 249th-place stock moving to 250th, which
 *   no one is looking at and which would bury the signal that matters.
 */

// Version and key format live in config/ because BOTH this engine and the
// data-layer store need them, and neither layer may import the other. See
// config/schema/snapshotSchema.js.
import { SNAPSHOT_VERSION, snapshotKey } from '../config/schema/snapshotSchema.js';
export { SNAPSHOT_VERSION, snapshotKey };

/** RS differences below this are floating-point noise, not a data change. */
const RS_EPSILON = 1e-6;

/**
 * Freeze one completed month-end.
 *
 * @param {object} args
 * @param {string} args.universeKey
 * @param {number} args.lookbackMonths
 * @param {object} args.rankingSnapshot  one entry from runBacktest's rankingHistory
 * @param {number} [args.topN]
 */
export function buildSnapshot({ universeKey, lookbackMonths, rankingSnapshot, topN = 5, priceBasis = 'adjClose' }) {
  const top = rankingSnapshot.rankings
    .filter((r) => r.rank != null && r.rank <= topN)
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({ symbol: r.symbol, rank: r.rank, rs: round(r.rs) }));

  return {
    version: SNAPSHOT_VERSION,
    universeKey,
    lookbackMonths,
    monthKey: rankingSnapshot.monthKey,
    signalDate: rankingSnapshot.date,
    priceBasis,
    picks: top,
    // Cheap identity for the inputs that produced this. A changed fingerprint
    // is the trigger to look closer; it is not itself the explanation.
    fingerprint: fingerprintPicks(top),
  };
}

/**
 * Compare a freshly-computed snapshot against a stored one.
 *
 * @returns {{
 *   changed:boolean, monthKey:string, kind:string|null,
 *   pickChanges:Array, rsChanges:Array, message:string|null
 * }}
 */
export function compareSnapshot(stored, fresh) {
  if (!stored || stored.version !== fresh.version) {
    return { changed: false, monthKey: fresh.monthKey, kind: null, pickChanges: [], rsChanges: [], message: null };
  }

  if (stored.fingerprint === fresh.fingerprint) {
    return { changed: false, monthKey: fresh.monthKey, kind: null, pickChanges: [], rsChanges: [], message: null };
  }

  const storedBySymbol = new Map(stored.picks.map((p) => [p.symbol, p]));
  const freshBySymbol = new Map(fresh.picks.map((p) => [p.symbol, p]));

  const pickChanges = [];
  for (const p of fresh.picks) {
    if (!storedBySymbol.has(p.symbol)) pickChanges.push({ symbol: p.symbol, change: 'added', rank: p.rank });
  }
  for (const p of stored.picks) {
    if (!freshBySymbol.has(p.symbol)) pickChanges.push({ symbol: p.symbol, change: 'removed', rank: p.rank });
  }

  const rsChanges = [];
  for (const p of fresh.picks) {
    const before = storedBySymbol.get(p.symbol);
    if (!before) continue;
    if (Math.abs(before.rs - p.rs) > RS_EPSILON) {
      rsChanges.push({ symbol: p.symbol, from: before.rs, to: p.rs, delta: p.rs - before.rs });
    }
  }

  // A changed SELECTION is materially more serious than a changed value: it
  // means the strategy would have bought something different, not merely that
  // a figure was restated.
  const kind = pickChanges.length > 0 ? 'selection-changed' : 'values-restated';

  return {
    changed: true,
    monthKey: fresh.monthKey,
    kind,
    pickChanges,
    rsChanges,
    message: describeChange({ monthKey: fresh.monthKey, kind, pickChanges, rsChanges }),
  };
}

/**
 * Plain-language explanation.
 *
 * States the LIKELY cause rather than asserting one. A corporate action is by
 * far the most common explanation, but it is an inference from the shape of
 * the change, not something observed — and the difference between "is" and
 * "most likely" is exactly the honesty this feature exists to demonstrate.
 */
function describeChange({ monthKey, kind, pickChanges, rsChanges }) {
  const affected = [...new Set([...pickChanges.map((c) => c.symbol), ...rsChanges.map((c) => c.symbol)])];
  const names = affected.slice(0, 3).join(', ');
  const more = affected.length > 3 ? ` and ${affected.length - 3} more` : '';

  if (kind === 'selection-changed') {
    return (
      `${monthKey}: the selected stocks have changed since this month was last computed ` +
      `(${names}${more}). A corporate action — a split, bonus or dividend — is the most ` +
      `likely cause: the data provider restates adjusted prices retroactively when one occurs.`
    );
  }
  return (
    `${monthKey}: relative-strength values have been restated for ${names}${more}, though the ` +
    `selected stocks are unchanged. A corporate action is the most likely cause.`
  );
}

/** Compare every fresh snapshot against its stored counterpart. */
export function compareAll(storedByKey, freshSnapshots) {
  const notes = [];
  for (const fresh of freshSnapshots) {
    const stored = storedByKey.get(snapshotKey(fresh));
    const result = compareSnapshot(stored, fresh);
    if (result.changed) notes.push(result);
  }
  return notes;
}

function fingerprintPicks(picks) {
  return picks.map((p) => `${p.symbol}@${p.rank}:${p.rs}`).join('|');
}

/** Six decimals absorbs genuine cross-platform floating-point noise while
 *  keeping any real restatement visible. */
function round(n) {
  return n == null ? null : Number(n.toFixed(6));
}

/**
 * Build an append-only revision record for a detected restatement.
 *
 * WHY THIS EXISTS SEPARATELY FROM compareSnapshot   (decision D10)
 *   The comparison produces a NOTE: transient, shown once, gone on the next
 *   render. That is enough to tell a user something changed, and not enough to
 *   tell them what it was. Once the fresh snapshot is written over the stored
 *   one, the previous figure is unrecoverable — and an audit trail that cannot
 *   reconstruct the prior state is a notification, not an audit.
 *
 *   So the previous picks are captured IN FULL here, not just the deltas.
 *   Deltas are cheaper and would be sufficient to redisplay the note; they
 *   would not let anyone rebuild what the app actually showed in June.
 *
 * Revisions are appended and never modified. A restatement that is itself
 * later restated produces two records, in order.
 */
export function buildRevision({ stored, fresh, comparison, observedAt }) {
  if (!comparison?.changed) return null;
  return {
    version: SNAPSHOT_VERSION,
    universeKey: fresh.universeKey,
    lookbackMonths: fresh.lookbackMonths,
    monthKey: fresh.monthKey,
    signalDate: fresh.signalDate,
    /** When the change was OBSERVED — not when the corporate action occurred,
     *  which the provider does not tell us and which must not be inferred. */
    observedAt,
    kind: comparison.kind,
    /** Full prior state, so what was previously displayed can be rebuilt. */
    previousPicks: stored.picks,
    currentPicks: fresh.picks,
    pickChanges: comparison.pickChanges,
    rsChanges: comparison.rsChanges,
    affectedSymbols: [
      ...new Set([
        ...comparison.pickChanges.map((c) => c.symbol),
        ...comparison.rsChanges.map((c) => c.symbol),
      ]),
    ],
    /** Stated as a likelihood, never as an observation. */
    likelyCause: 'corporate-action',
    message: comparison.message,
  };
}

/** Revisions for one month, oldest first, so a chain of restatements reads in order. */
export function sortRevisions(revisions = []) {
  return [...revisions].sort((a, b) => String(a.observedAt).localeCompare(String(b.observedAt)));
}
