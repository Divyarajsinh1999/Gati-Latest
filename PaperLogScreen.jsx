/**
 * PAPER LOG — what you said you would do, before you knew how it went (D25).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT THIS SCREEN IS FOR
 *
 * The strategy record shows how every month's Top 5 performed. It cannot tell
 * the owner whether HE would have sat through a bad month, because reading
 * history is unavoidably done with hindsight. Writing down an intention before
 * the outcome is the only way to find that out.
 *
 * SO THIS SCREEN SHOWS NO PERFORMANCE. Not a return, not a value, not a
 * comparison. Every number on it would be a recomputation of something the
 * record already owns, and a second copy of a figure is a second chance for
 * it to be wrong. The entry says what was believed; the record says what
 * happened; the reader puts them together.
 *
 * UNDER SYSTEM, NOT WORKSPACE (D26). A journal is consulted, not worked in.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { useJournal, MAX_NOTE_LENGTH } from '../hooks/useJournal.js';
import { UNIVERSES, UNIVERSE_KEYS } from '../config/universes.js';
import { AppBar } from '../components/layout/AppBar.jsx';
import { Card, Section } from '../components/primitives/Surface.jsx';
import { Button, Chip, Segmented } from '../components/primitives/index.jsx';
import { EmptyState } from '../components/feedback/index.jsx';
import { formatDate } from '../utils/formatters.js';

/** The current month as YYYY-MM, in the reader's own timezone. */
function thisMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function PaperLogScreen() {
  const journal = useJournal();
  const [universeKey, setUniverseKey] = useState(UNIVERSE_KEYS[0]);
  const [note, setNote] = useState('');
  const [symbolText, setSymbolText] = useState('');
  const [followedRanking, setFollowedRanking] = useState(true);
  const [error, setError] = useState(null);

  async function save() {
    setError(null);
    const result = await journal.add({
      monthKey: thisMonthKey(),
      universeKey,
      note,
      // Split on commas and whitespace; the store uppercases and de-duplicates.
      symbols: symbolText.split(/[\s,]+/).filter(Boolean),
      followedRanking,
    });
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setNote('');
    setSymbolText('');
  }

  return (
    <>
      <AppBar
        eyebrow="DECISION JOURNAL"
        title="Paper log"
        subtitle="What you said you would do, written down before you knew how it went."
      />

      {/*
        Storage is local and has no account behind it. Said once, here, rather
        than on every entry — the same disclosure the portfolio makes, for the
        same reason.
      */}
      {journal.isDegraded ? (
        <Card padded style={{ marginBottom: 16, borderColor: 'var(--color-warn)' }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-warn)' }}>
            This browser has storage disabled, so entries will not survive a reload.
          </p>
        </Card>
      ) : null}

      <Section
        title={`This month · ${thisMonthKey()}`}
        why="Write it before the month ends. An entry added afterwards is a memory, not a record."
      >
        <Card padded>
          <div style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={FIELD_LABEL}>Universe</span>
              <Segmented
                value={universeKey}
                onChange={setUniverseKey}
                options={UNIVERSE_KEYS.map((k) => ({ value: k, label: UNIVERSES[k].shortLabel }))}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={FIELD_LABEL}>Did you follow the ranking?</span>
              <Segmented
                value={followedRanking ? 'yes' : 'no'}
                onChange={(v) => setFollowedRanking(v === 'yes')}
                options={[{ value: 'yes', label: 'FOLLOWED IT' }, { value: 'no', label: 'DID SOMETHING ELSE' }]}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={FIELD_LABEL}>Stocks you would actually buy</span>
              <input
                type="text"
                value={symbolText}
                onChange={(e) => setSymbolText(e.target.value)}
                placeholder="WIPRO.NS, TRENT.NS"
                style={FIELD_INPUT}
              />
              {/* Not validated against the Top 5 on purpose: the months worth
                  re-reading are the ones where the reader disagreed with it. */}
              <span style={FIELD_HINT}>
                Separate with commas. These need not match the Top 5 — a deviation is
                the most useful thing to record.
              </span>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={FIELD_LABEL}>Why</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={MAX_NOTE_LENGTH}
                placeholder="Skipped the smallcap pick — too thin to get out of."
                style={{ ...FIELD_INPUT, resize: 'vertical', lineHeight: 1.5 }}
              />
            </label>

            {error ? (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-loss)' }}>{error}</p>
            ) : null}

            <div>
              <Button onClick={save}>Record this month</Button>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Earlier entries">
        {journal.isEmpty ? (
          <EmptyState
            title="Nothing recorded yet"
            body="Record what you would do this month, then come back after the rebalance and read it against the strategy record. Six months of this tells you more about whether you can follow the rule than any backtest can."
          />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {journal.entries.map((entry) => (
              <Card key={entry.id} padded>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{entry.monthKey}</strong>
                  <Chip tone="neutral">{UNIVERSES[entry.universeKey]?.shortLabel ?? entry.universeKey}</Chip>
                  <Chip tone={entry.followedRanking ? 'gain' : 'warn'}>
                    {entry.followedRanking ? 'Followed the ranking' : 'Did something else'}
                  </Chip>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-ink-muted)' }}>
                    {/* The date it was WRITTEN, which is the whole point. */}
                    written {formatDate(entry.createdAt)}
                  </span>
                </div>

                {entry.symbols.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {entry.symbols.map((symbol) => (
                      <span key={symbol} style={SYMBOL_CHIP}>{symbol}</span>
                    ))}
                  </div>
                ) : null}

                {entry.note ? (
                  <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--color-ink)' }}>
                    {entry.note}
                  </p>
                ) : null}

                <div style={{ marginTop: 10 }}>
                  <Button variant="quiet" onClick={() => journal.remove(entry.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

const FIELD_LABEL = {
  fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--color-ink-muted)',
};

const FIELD_HINT = { fontSize: 11, color: 'var(--color-ink-muted)', lineHeight: 1.45 };

const FIELD_INPUT = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--color-line)', background: 'var(--color-surface-raised)',
  color: 'var(--color-ink)', fontSize: 13, fontFamily: 'var(--font-body)',
  // 44px minimum touch target once padding and line-height are counted.
  minHeight: 44,
};

const SYMBOL_CHIP = {
  padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-line)',
  background: 'var(--color-surface-raised)', fontFamily: 'var(--font-mono)',
  fontSize: 11, color: 'var(--color-ink)',
};

export default PaperLogScreen;
