/**
 * YOUR INVESTMENT — this stock, this reader, real money.
 *
 * WHAT THIS OWNS
 *   The form and the summary. Storage is the existing `portfolioStore`;
 *   valuation is the existing `valuePortfolio` and `aggregateLots`. No new
 *   persistence, no new arithmetic.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS REPLACED THE GLOBAL "YOUR AMOUNT" BOX
 *
 * The Top 5 card used to carry one field that sized all five picks at once.
 * It could only ever describe a hypothetical: five stocks bought in a single
 * transaction, today, in equal parts. Nobody holds stock that way, so the
 * share counts it produced belonged to no actual position and its profit
 * figure was arithmetic about a portfolio that did not exist.
 *
 * Investment is a property of a STOCK the reader actually bought, at a
 * quantity and a price and on a date. That is what this records.
 *
 * MULTIPLE LOTS WORK TODAY, NOT "LATER"
 * The store has always kept one record per purchase — a second buy never
 * mutates the first — and `aggregateLots` already combines them at
 * weighted-average cost. So a reader can add 10 @ ₹1,000 and then 15 @
 * ₹1,100 and see one line at 25 @ ₹1,060, with both lots individually
 * editable. Nothing here had to be designed around a future feature.
 *
 * THE RULE THAT MATTERS MOST
 * With no current price, this shows the cost of the holding and says the
 * value is unavailable. It never marks the position at cost (a fabricated
 * break-even) or at zero (a fabricated wipeout). Both would be numbers the
 * data does not support, presented as confidently as one that is.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useMemo } from 'react';
import { usePortfolio } from '../../hooks/usePortfolio.js';
import { selectInvestment } from '../../selectors/investmentView.js';
import { formatINR, formatPct, formatDate } from '../../utils/formatters.js';
import { Button, Chip } from '../../components/primitives/index.jsx';
import { Card, CardRow, Section, Stat, StatGrid, StatCell } from '../../components/primitives/Surface.jsx';
import { InfoTip } from '../../components/data/index.jsx';
import { AddPositionModal } from '../../components/portfolio/AddPositionModal.jsx';
import { IconWarning } from '../../design/icons.jsx';

export function InvestmentCard({ symbol, name, universeKey, currentPrice, volume = null }) {
  const portfolio = usePortfolio();
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  /** Only this stock's lots. The store holds every universe's positions. */
  const lots = useMemo(
    () => portfolio.positions.filter((position) => position.symbol === symbol),
    [portfolio.positions, symbol],
  );

  const summary = useMemo(
    () => selectInvestment({ lots, currentPrice, volume }),
    [lots, currentPrice, volume],
  );
  const editingLot = useMemo(() => lots.find((lot) => lot.id === editingId) ?? null, [lots, editingId]);

  return (
    <Section
      title="Your investment"
      why="Optional, private to this device, and never mixed into the strategy's own record."
      info={<InfoTip term="unrealisedPnl" />}
    >
      {portfolio.isDegraded ? (
        <div
          role="status"
          style={{
            marginBottom: 10, padding: 10, borderRadius: 8,
            background: 'var(--color-warn-soft)', fontFamily: 'var(--font-display)',
            fontSize: 12, color: 'var(--color-ink-soft)',
          }}
        >
          This browser is blocking durable storage, so anything entered here lasts only for this session.
        </div>
      ) : null}

      <Card>
        {summary ? (
          <>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-line)' }}>
              <StatGrid min={124}>
                <StatCell>
                  <Stat
                    label="Invested"
                    value={formatINR(summary.invested)}
                    sublabel={`${summary.quantity} share${summary.quantity === 1 ? '' : 's'} @ ${formatINR(summary.averageCost)}`}
                  />
                </StatCell>
                <StatCell>
                  <Stat
                    label="Current value"
                    value={summary.currentValue == null ? 'unavailable' : formatINR(summary.currentValue)}
                    sublabel={summary.currentValue == null ? 'no current price' : `at ${formatINR(currentPrice)}`}
                  />
                </StatCell>
                <StatCell>
                  <Stat
                    label="Gain / loss"
                    value={summary.gain == null ? '—' : formatINR(summary.gain, { showSign: true })}
                    direction={summary.gain == null ? null : summary.gain >= 0 ? 'gain' : 'loss'}
                  />
                </StatCell>
                <StatCell>
                  <Stat
                    label="Return"
                    value={summary.gainPct == null ? '—' : formatPct(summary.gainPct)}
                    direction={summary.gainPct == null ? null : summary.gainPct >= 0 ? 'gain' : 'loss'}
                  />
                </StatCell>
              </StatGrid>

              {/*
                LIQUIDITY (D24). Shown only when the position is a material
                share of a day's turnover — below 1% it is noise in the flow,
                and a line that appears on every stock is a line nobody reads.

                Says "one session" plainly. The volume available here is the
                latest bar, not an average: a quiet day understates liquidity
                and a news day overstates it, and presenting one session as
                typical would be a claim the data does not support.
              */}
              {summary.liquidity && summary.liquidity.severity !== 'ok' ? (
                <p
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                    margin: '12px 0 0', fontSize: 11.5, lineHeight: 1.5,
                    color: summary.liquidity.severity === 'warn'
                      ? 'var(--color-warn)' : 'var(--color-ink-muted)',
                  }}
                >
                  {summary.liquidity.severity === 'warn' ? <IconWarning size={13} /> : null}
                  <span>
                    This position is{' '}
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>
                      {summary.liquidity.sharePct.toFixed(1)}%
                    </strong>{' '}
                    of the last session&rsquo;s traded value
                    ({formatINR(summary.liquidity.dailyValue)}). Selling a large share of a
                    day&rsquo;s turnover can move the price against you. One session, not an
                    average.
                  </span>
                </p>
              ) : null}

              {summary.lotCount > 1 ? (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Chip tone="neutral">{summary.lotCount} purchases</Chip>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 11.5, color: 'var(--color-ink-muted)' }}>
                    combined at weighted-average cost since {formatDate(summary.firstPurchase)}
                  </span>
                </div>
              ) : null}
            </div>

            {lots.map((lot, i) => (
              <CardRow key={lot.id} isLast={i === lots.length - 1}>
                  <span className="tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink)' }}>
                    {lot.quantity} @ {formatINR(lot.purchasePrice)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)' }}>
                    {formatDate(lot.purchaseDate)}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <Button variant="quiet" onClick={() => setEditingId(lot.id)} aria-label={`Edit purchase of ${lot.quantity} shares`}>
                      Edit
                    </Button>
                    <Button variant="quiet" onClick={() => portfolio.remove(lot.id)} aria-label={`Delete purchase of ${lot.quantity} shares`}>
                      Delete
                    </Button>
                  </span>
              </CardRow>
            ))}
          </>
        ) : null}

        {/*
          THE ONLY ACTION, whether or not anything is recorded yet. Both
          paths open the SAME modal the portfolio screen uses — one form,
          one store, one set of rules. The stock screen used to carry its
          own inline form, which is how it came to be the only one of the
          two with a purchase-date field.
        */}
        <div style={{ padding: '12px 16px', borderTop: summary ? '1px solid var(--color-line)' : 'none' }}>
          <Button variant={summary ? 'secondary' : 'primary'} onClick={() => setIsAdding(true)}>
            {summary ? 'Add another purchase' : 'Add position'}
          </Button>
        </div>
      </Card>

      {isAdding || editingLot ? (
        <AddPositionModal
          portfolio={portfolio}
          // The stock is already on screen — asking the reader to type its
          // name again would be asking them to repeat the app back to it.
          stock={{ symbol, name, universeKey }}
          currentPrice={currentPrice}
          lot={editingLot}
          onClose={() => {
            setIsAdding(false);
            setEditingId(null);
          }}
        />
      ) : null}
    </Section>
  );
}
