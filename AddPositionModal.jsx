/**
 * ADD A POSITION.
 *
 * WHAT THIS OWNS
 *   One way to record a purchase, used from both entry points — the
 *   portfolio's own button and (from Phase 13) a stock's detail screen.
 *   Storage and validation stay in `portfolioStore`; this only collects.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT WAS WRONG WITH THE PREVIOUS SHEET
 *
 * 1. IT HAD NO PURCHASE DATE FIELD. The store defaults a missing date to
 *    TODAY, so every position recorded here was silently stamped with the
 *    day it was entered rather than the day it was bought. A holding added
 *    on Saturday for a trade made in May was dated Saturday, and nothing
 *    said so. This is the reason this phase mattered.
 *
 * 2. NO VISIBLE WAY OUT. There was no close control at all. Escape was
 *    bound to the dialog element, so it only worked while focus was already
 *    inside; the backdrop closed on mousedown, which is not discoverable.
 *
 * 3. THE SHARES/AMOUNT SWITCH WAS A SENTENCE. "Enter an amount instead"
 *    sat inline with the field it modified, at a different height, so the
 *    row had two controls of different sizes doing different jobs. It is
 *    now a segmented control above the field, which is what a choice
 *    between two mutually exclusive inputs looks like.
 *
 * 4. NOTHING RESERVED THE SAFE AREA. A bottom sheet on a phone with a home
 *    indicator put its primary action under the indicator.
 *
 * THE SHAPE: a fixed header, a scrolling body, a fixed footer. The footer
 * matters — with everything in one scroller, the Save button on a short
 * landscape screen sits below the fold, and the reader has to scroll a form
 * they have already filled in to find it.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { UNIVERSES, UNIVERSE_KEYS } from '../../config/universes.js';
import { STORAGE_DISCLOSURE } from '../../hooks/usePortfolio.js';
import { Button, Field, Segmented } from '../primitives/index.jsx';
import { IconClose } from '../../design/icons.jsx';
import { formatINR } from '../../utils/formatters.js';

const todayISO = () => new Date().toISOString().slice(0, 10);

const MODES = [
  { value: 'shares', label: 'Shares' },
  { value: 'amount', label: 'Amount' },
];

/**
 * @param {object} props
 * @param {object} props.portfolio          from usePortfolio
 * @param {Map} [props.priceBySymbol]       latest quotes, for prefilling price
 * @param {{symbol,name,universeKey}} [props.stock]
 *   When supplied the stock is fixed and its picker is not shown — the
 *   detail-screen entry point knows which stock it is, and asking again
 *   would be asking the reader to retype something already on screen.
 * @param {number} [props.currentPrice]
 * @param {() => void} props.onClose
 */
export function AddPositionModal({ portfolio, priceBySymbol, stock, currentPrice, lot, onClose }) {
  const isFixedStock = Boolean(stock?.symbol);
  /**
   * EDITING USES THIS SAME COMPONENT.
   *
   * The stock screen previously carried its own inline form for adding and
   * correcting a purchase, so two pieces of code collected the same four
   * values and only one of them had a date field. A second form is a second
   * place for the next omission to hide.
   */
  const isEditing = Boolean(lot?.id);

  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState(stock ?? null);
  const [price, setPrice] = useState(() => {
    if (lot) return String(lot.purchasePrice);
    // Prefilled from the live price as a STARTING POINT for a new purchase,
    // never for an edit — overwriting what someone actually paid with
    // today's price would be the worst possible default.
    const quoted = currentPrice ?? (stock ? priceBySymbol?.get(stock.symbol)?.price : null);
    return quoted ? String(Number(quoted).toFixed(2)) : '';
  });
  const [quantity, setQuantity] = useState(() => (lot ? String(lot.quantity) : ''));
  const [amount, setAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => lot?.purchaseDate ?? todayISO());
  const [mode, setMode] = useState('shares');
  const [problems, setProblems] = useState([]);
  const [busy, setBusy] = useState(false);

  const closeRef = useRef(null);

  // Escape closes from anywhere, not only when focus is already inside the
  // dialog — which was the previous behaviour and effectively meant never.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    if (isFixedStock) return [];
    const term = search.trim().toUpperCase();
    if (term.length < 2) return [];
    return UNIVERSE_KEYS.flatMap((key) =>
      (UNIVERSES[key].stocks ?? [])
        .filter((s) => s.symbol.includes(term) || s.name.toUpperCase().includes(term))
        .slice(0, 4)
        .map((s) => ({ ...s, universeKey: key })),
    ).slice(0, 6);
  }, [search, isFixedStock]);

  const numericPrice = Number(price);
  /**
   * Whole shares only, in both directions. An amount is converted by
   * flooring — you cannot buy 4.7 shares in the Indian cash market, and
   * storing a fraction would put a number in the portfolio that could never
   * have been traded.
   */
  const derivedShares =
    mode === 'amount' && numericPrice > 0 ? Math.floor(Number(amount) / numericPrice) : Number(quantity);
  const investedPreview =
    Number.isFinite(derivedShares) && derivedShares > 0 && numericPrice > 0 ? derivedShares * numericPrice : null;
  const leftover =
    mode === 'amount' && investedPreview != null ? Number(amount) - investedPreview : null;

  const save = useCallback(async () => {
    setBusy(true);
    if (portfolio.needsDisclosure) portfolio.acknowledgeDisclosure();
    const payload = {
      symbol: chosen?.symbol ?? search.trim().toUpperCase(),
      name: chosen?.name,
      universeKey: chosen?.universeKey,
      purchasePrice: numericPrice,
      quantity: Number.isFinite(derivedShares) ? derivedShares : 0,
      // Explicit, always. Omitting it makes the store stamp today.
      purchaseDate,
    };
    const result = isEditing ? await portfolio.update(lot.id, payload) : await portfolio.add(payload);
    setBusy(false);
    if (result.ok) onClose();
    else setProblems(result.problems ?? ['That could not be saved']);
  }, [portfolio, chosen, search, numericPrice, derivedShares, purchaseDate, isEditing, lot, onClose]);

  return (
    <div
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-position-title"
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: 480,
          // Never taller than the viewport, and never under the notch.
          maxHeight: 'calc(100dvh - var(--safe-top) - 24px)',
          borderRadius: '16px 16px 0 0',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          overflow: 'hidden',
        }}
      >
        {/* HEADER — fixed. Title small and quiet; the close control is the
            largest thing in it, because getting out must never be a hunt. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 8px 12px 20px',
            borderBottom: '1px solid var(--color-line)',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              id="add-position-title"
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--color-ink)',
              }}
            >
              {isEditing ? 'Edit purchase' : 'Add a position'}
            </h2>
            {isFixedStock ? (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--color-ink-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {stock.name} · {stock.symbol}
              </div>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close without saving"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-ink-muted)',
              flexShrink: 0,
            }}
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* BODY — the only scrolling region. */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0, overscrollBehavior: 'contain' }}>
          {portfolio.needsDisclosure ? (
            <p
              style={{
                margin: '0 0 16px',
                padding: 10,
                borderRadius: 8,
                background: 'var(--color-warn-soft)',
                fontFamily: 'var(--font-display)',
                fontSize: 11.5,
                lineHeight: 1.5,
                color: 'var(--color-ink-soft)',
              }}
            >
              {STORAGE_DISCLOSURE}
            </p>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!isFixedStock ? (
              <div>
                <Field
                  fullWidth
                  id="pos-symbol"
                  label="Stock"
                  value={chosen ? chosen.name : search}
                  onChange={(event) => {
                    setChosen(null);
                    setSearch(event.target.value);
                  }}
                  placeholder="Name or ticker"
                />
                {!chosen && matches.length > 0 ? (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: '6px 0 0',
                      padding: 0,
                      border: '1px solid var(--color-line)',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    {matches.map((match) => (
                      <li key={`${match.universeKey}:${match.symbol}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setChosen(match);
                            const quoted = priceBySymbol?.get(match.symbol)?.price;
                            if (quoted && !price) setPrice(String(Number(quoted).toFixed(2)));
                          }}
                          style={{
                            display: 'flex',
                            width: '100%',
                            gap: 8,
                            minHeight: 44,
                            alignItems: 'center',
                            padding: '8px 10px',
                            border: 'none',
                            borderBottom: '1px solid var(--color-line)',
                            background: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'var(--font-display)',
                            fontSize: 13,
                            color: 'var(--color-ink)',
                          }}
                        >
                          {match.name}
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10.5,
                              color: 'var(--color-ink-muted)',
                            }}
                          >
                            {match.symbol}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {/*
              The choice comes BEFORE the field it governs, so the reader
              picks how they want to enter the position and then enters it —
              rather than filling a box and discovering afterwards that the
              other box was available.
            */}
            <Segmented
              label="Enter the size as"
              name="position-mode"
              options={MODES}
              value={mode}
              onChange={setMode}
            />

            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              {mode === 'shares' ? (
                <Field
                  fullWidth
                  id="pos-qty"
                  label="Shares"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="0"
                />
              ) : (
                <Field
                  fullWidth
                  id="pos-amt"
                  label="Amount spent"
                  prefix="₹"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                />
              )}
              <Field
                fullWidth
                id="pos-price"
                label="Purchase price"
                prefix="₹"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
              />
              {/*
                THE FIELD THAT WAS MISSING. Without it the store stamped the
                position with the day it was entered, so a May purchase
                recorded in August was dated August and nothing said so.
              */}
              <Field
                fullWidth
                id="pos-date"
                label="Purchase date"
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
              />
            </div>

            {/* What will actually be stored, before it is stored. */}
            {investedPreview != null ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--color-surface-raised)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--color-ink-soft)',
                }}
              >
                {derivedShares} share{derivedShares === 1 ? '' : 's'} · {formatINR(investedPreview)}
                {leftover != null && leftover > 0 ? (
                  <>
                    <br />
                    {/* Whole shares only, so an amount rarely divides exactly.
                        Saying what is left over stops the stored figure
                        looking like a rounding error. */}
                    <span style={{ color: 'var(--color-ink-muted)' }}>
                      {formatINR(leftover)} of your amount buys less than one more share
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}

            {problems.length > 0 ? (
              <ul
                role="alert"
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  color: 'var(--color-loss)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                }}
              >
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {/* FOOTER — fixed, and clear of the home indicator. */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            padding: '12px 20px',
            paddingBottom: 'calc(12px + var(--safe-bottom))',
            borderTop: '1px solid var(--color-line)',
            background: 'var(--color-surface)',
            flexShrink: 0,
          }}
        >
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {isEditing ? 'Save changes' : 'Save position'}
          </Button>
        </div>
      </div>
    </div>
  );
}
