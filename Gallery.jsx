/**
 * COMPONENT GALLERY — every component, every state, both themes.
 *
 * WHAT THIS OWNS
 *   A single place to see the design system as a system rather than as
 *   fragments scattered across screens.
 *
 * WHAT THIS MUST NEVER DO
 *   Ship to users. It is a development surface, mounted only outside
 *   production builds.
 *
 * WHY IT EARNS ITS KEEP
 *   Inconsistency in a design system is invisible one screen at a time. Two
 *   components drift a pixel apart, a third invents its own disabled colour,
 *   and nobody notices until the interface has quietly stopped looking
 *   designed. Seeing them side by side makes the drift obvious in seconds —
 *   and it is the only practical way to check every EMPTY and FAILED state,
 *   which by definition are hard to reach in the real app.
 */

import { useState } from 'react';
import {
  Button, Segmented, Chip, RankBadge, Field, Skeleton,
} from '../../components/primitives/index.jsx';
import {
  InfoTip, MetricTile, MetricGroup, RSLedger, RSLedgerKey,
} from '../../components/data/index.jsx';
import {
  StatusLine, DataNotes, EmptyState, ErrorState, OfflineState,
  MarketClosedState, InsufficientHistoryState, StateIllustration,
} from '../../components/feedback/index.jsx';
import { ICONS, strokeFor } from '../../design/icons.jsx';

function Row({ title, note, children }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.028em', color: 'var(--color-ink)', margin: '0 0 4px' }}>
        {title}
      </h2>
      {note ? (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--color-ink-muted)', margin: '0 0 12px', maxWidth: 620, lineHeight: 1.5 }}>{note}</p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>{children}</div>
    </section>
  );
}

export default function Gallery() {
  const [window_, setWindow] = useState('1m');
  const [amount, setAmount] = useState('50000');

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 32, background: 'var(--color-canvas)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, letterSpacing: '-0.028em', color: 'var(--color-ink)', marginBottom: 4 }}>
        Component gallery
      </h1>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 40 }}>
        Development surface. Toggle the theme in the app header to check both.
      </p>

      <Row title="Buttons" note="Four styles, and only four. Maximum one primary per screen. Destructive is outlined with loss-coloured text — a filled red button invites the accident it warns about.">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="quiet">View all 250 →</Button>
        <Button variant="destructive">Delete position</Button>
        <Button variant="secondary" disabled>Disabled</Button>
      </Row>

      <Row title="Segmented control" note="A disabled segment always states why on hover or tap. Silently inert controls make people think the app is broken.">
        <Segmented
          label="Measured over"
          value={window_}
          onChange={setWindow}
          options={[
            { value: '1m', label: '1M' },
            { value: '3m', label: '3M' },
            { value: '6m', label: '6M' },
            { value: '12m', label: '12M' },
          ]}
        />
        <Segmented
          label="Range"
          value="1y"
          onChange={() => {}}
          options={[
            { value: '3m', label: '3M' },
            { value: '1y', label: '1Y' },
            { value: '3y', label: '3Y', disabled: true, disabledReason: 'Needs data before Jan 2025' },
            { value: '5y', label: '5Y', disabled: true, disabledReason: 'Needs data before Jan 2025' },
          ]}
        />
      </Row>

      <Row title="Chips and rank badges" note="Rank is always a numeral, never conveyed by colour intensity. Signed values only ever carry direction colour.">
        <Chip tone="gain">+11.4%</Chip>
        <Chip tone="loss">−3.2%</Chip>
        <Chip tone="warn">Thin sample</Chip>
        <Chip tone="gold">1M window</Chip>
        <Chip tone="neutral">453 stocks</Chip>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <RankBadge rank={1} isTop /><RankBadge rank={5} isTop /><RankBadge rank={42} /><RankBadge rank={null} />
        </span>
      </Row>

      <Row title="Field" note="Tabular figures, so a changing amount does not shift the caret.">
        <Field label="Investment amount" prefix="₹" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
      </Row>

      <Row title="Contextual help (D9)" note="Two tiers (D11): three short sentences by default, with Learn more expanding into detail, a worked example, limitations, and a formula only where the formula is the meaning. Click, never hover-only — hover is unreachable on touch and fires constantly across a dense table.">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
          Sharpe ratio <InfoTip term="sharpe" />
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
          Cash drag <InfoTip term="cashDrag" />
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
          Relative Strength <InfoTip term="relativeStrength" />
        </span>
      </Row>

      <Row title="Metric tiles" note="Tiles share one container border with 1px gaps. Individually-bordered tiles create a visible mesh of competing edges.">
        <div style={{ minWidth: 420 }}>
          <MetricGroup title="Performance">
            <MetricTile label="Total return" value="+21.3%" glossaryKey="totalReturn" direction="gain" sublabel="since Jan 2025" />
            <MetricTile label="Outperformance" value="+11.4%" glossaryKey="outperformance" direction="gain" sublabel="vs benchmark" />
            <MetricTile label="Max drawdown" value="−8.7%" glossaryKey="maxDrawdown" direction="loss" sublabel="peak to trough" />
          </MetricGroup>
        </div>
        <div style={{ minWidth: 420 }}>
          <MetricGroup title="Risk" collapsible defaultOpen={false} headline="−8.7% max DD">
            <MetricTile label="Volatility" value="14.2%" glossaryKey="volatility" />
            <MetricTile label="Sharpe" value="1.32" glossaryKey="sharpe" />
            <MetricTile label="Sortino" value="1.88" glossaryKey="sortino" />
          </MetricGroup>
        </div>
      </Row>

      <Row title="RS Ledger" note="The signature component. Solid bar is the stock, hatched ghost is the benchmark, and the visible gap IS the RS value. Overflow is clipped, never rescaled — one runaway stock must not silently rescale every other row.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <RSLedgerKey />
          {[[18.6, -0.2], [4.1, 3.9], [-6.4, 2.2], [35, 1], [null, 2]].map(([s, b], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <RSLedger stockReturnPct={s} benchmarkReturnPct={b} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-muted)' }}>
                {s == null ? 'no data' : `Stock ${s > 0 ? '+' : ''}${s}% · Bench ${b > 0 ? '+' : ''}${b}%`}
              </span>
            </div>
          ))}
        </div>
      </Row>

      <Row title="Status line" note="One line. Not a pill plus two timestamps plus two badges. The dot pulses only when data is genuinely live.">
        <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <StatusLine tone="live" state="Market open · Live" detail="Data as of 3 Aug" />
          <StatusLine tone="closed" state="Market closed" detail="Last close 1 Aug" />
          <StatusLine tone="degraded" state="Live prices unavailable" detail="Showing last close" />
          <StatusLine tone="failed" state="Market data could not be loaded" />
          <MarketClosedState isWeekend lastClose="1 Aug" />
          <MarketClosedState holidayName="Independence Day" lastClose="14 Aug" />
        </div>
      </Row>

      <Row title="Data notes" note="One consolidated surface, severity-ranked. Failures first, then exclusions, then informational — a flat list makes a dead ticker look as urgent as a footnote.">
        <div style={{ width: 480, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DataNotes notes={[{ severity: 'exclusion', title: '3 of 250 stocks excluded', body: 'Their price history could not be loaded. They appear unranked at the end of the full ranking.' }]} />
          <DataNotes notes={[{ severity: 'failure', title: 'Benchmark data unavailable', body: 'Relative Strength cannot be calculated without it. No values are being estimated.' }]} />
          <DataNotes notes={[{ severity: 'info', title: 'March 2025 has been restated', body: 'Values changed since this month was last computed. A corporate action is the most likely cause.' }]} />
        </div>
      </Row>

      <Row title="Illustrations" note="Two primitives from the mark: a dashed baseline and a solid arc. The relationship between them encodes the state.">
        {[
          ['crossing', 'full', 'gold', 'working'],
          ['below', 'full', 'muted', 'not enough evidence'],
          ['none', 'full', 'muted', 'market stopped'],
          ['none', 'broken', 'warn', 'connection broken'],
          ['none', 'halfMissing', 'loss', 'data missing'],
        ].map(([arc, baseline, accent, label]) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <StateIllustration arc={arc} baseline={baseline} accent={accent} size={100} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-ink-muted)' }}>{label}</div>
          </div>
        ))}
      </Row>

      <Row title="Empty and failed states" note="Every one has three parts: what is empty, why, and one action — or an explicit statement that there is nothing to do.">
        <div style={{ width: 460, border: '1px solid var(--color-line)', borderRadius: 10 }}>
          <ErrorState what="Market data could not be loaded" reason="The data provider returned an error." onRetry={() => {}} />
        </div>
        <div style={{ width: 460, border: '1px solid var(--color-line)', borderRadius: 10 }}>
          <InsufficientHistoryState needed={13} have={7} onSwitchWindow={() => {}} />
        </div>
        <div style={{ width: 460, border: '1px solid var(--color-line)', borderRadius: 10 }}>
          <OfflineState onRetry={() => {}} />
        </div>
        <div style={{ width: 460, border: '1px solid var(--color-line)', borderRadius: 10 }}>
          <EmptyState title='No stock matches "XYZ"' body="Try a different name or ticker." arc="none" baseline="full" />
        </div>
      </Row>

      <Row title="Skeletons" note="No spinners exist anywhere in Gati. A spinner says duration unknown; a skeleton says shape known, which is more useful and calmer.">
        <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton height={44} radius={10} />
          <Skeleton width="100%" />
          <Skeleton width="88%" />
          <Skeleton width="94%" />
        </div>
      </Row>

      <Row title={`Icons (${Object.keys(ICONS).length})`} note={`Drawn on a 24px grid, outline only. Stroke is redrawn per size band — ${strokeFor(16)}px at 16, ${strokeFor(20)}px at 20-24, ${strokeFor(32)}px at 32 — never scaled. The three universe icons are one family at three widths.`}>
        {Object.entries(ICONS).map(([name, Comp]) => (
          <div key={name} style={{ width: 92, textAlign: 'center', color: 'var(--color-ink-soft)' }}>
            <Comp size={24} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-ink-muted)', marginTop: 4, wordBreak: 'break-all' }}>
              {name.replace('Icon', '')}
            </div>
          </div>
        ))}
      </Row>
    </div>
  );
}
