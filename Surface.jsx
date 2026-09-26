/**
 * SURFACES — the shared vocabulary every screen composes from.
 *
 * WHAT THIS OWNS
 *   Cards, section headers, stat blocks, rows and dividers: the containers
 *   that give the app one voice.
 *
 * WHAT THIS MUST NEVER DO
 *   Know about the domain. Nothing here has heard of a stock or a benchmark.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 *
 * Measured before writing it: 176 separate inline style objects across five
 * screens, each re-declaring padding, radius, border and background. Every one
 * was individually reasonable and collectively they were drifting — a 10px
 * radius here, 12px padding there, three different ways to draw the same card.
 *
 * Inconsistency in a design system is invisible one screen at a time. It shows
 * up as a vague sense that the product is unfinished, and it is impossible to
 * fix by editing screens one by one, because the next screen invents its own
 * again.
 *
 * So the containers move here, screens compose them, and a spacing change
 * happens once. This is a REFACTOR, not a redesign: every value below comes
 * from the approved visual system, and no screen's information changes.
 * ═════════════════════════════════════════════════════════════════════════
 */

/**
 * NOTE: this file imports nothing from the domain — not the glossary, not a
 * selector, not an engine. Contextual help arrives as an `info` NODE that the
 * screen passes in, so a primitive never has to know what a Sharpe ratio is.
 * Reaching for the glossary here would have been convenient and would have
 * made every primitive dependent on domain content.
 */

/** The one section rhythm. Twice the card gap, so grouping is unambiguous. */
export const SECTION_GAP = 32;

/**
 * A card.
 *
 * M14 (D18) gave this the reference build's panel treatment: an 11px radius,
 * a hairline, and a shallow diagonal gradient rather than a flat fill. The
 * gradient is what stops a grid of dark panels reading as one continuous
 * sheet — a 3% lift across 145deg is enough to separate them without any
 * panel looking lit.
 *
 * THIS IS THE ONLY PLACE THE CARD IS DRAWN, and that is the whole reason the
 * reskin was a small change: every screen composes this, so the treatment
 * moved once. The 176 inline style objects this file replaced would each
 * have needed editing, and the next screen would have invented its own again.
 *
 * The shadow is theme-dependent for a reason that predates M14 and still
 * holds: a dark card with a real drop shadow reads as cheap, so dark carries
 * separation on the border and the surface step instead. `color-mix` against
 * `ink` gives one declaration that resolves to a soft grey on light and to
 * near-nothing on dark, rather than two rules and a media query.
 */
export function Card({ children, padded = false, tone = 'default', style, ...rest }) {
  return (
    <div
      style={{
        background: tone === 'raised'
          ? 'var(--color-surface-raised)'
          : 'linear-gradient(145deg, var(--color-surface), color-mix(in srgb, var(--color-surface) 92%, var(--color-canvas)))',
        border: '1px solid var(--color-line)',
        borderRadius: 11,
        overflow: 'hidden',
        boxShadow: '0 8px 30px color-mix(in srgb, var(--color-ink) 6%, transparent)',
        ...(padded ? { padding: 19 } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * A section: eyebrow, optional explanation, content.
 *
 * The explanation is not decoration. Every section in the app states what it
 * is for, because a reader who cannot tell why a block exists will skip it —
 * and skipping is indistinguishable from the block not being there.
 */
export function Section({ title, why, info, action, children, gap = SECTION_GAP }) {
  return (
    <section style={{ marginTop: gap }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
          }}
        >
          {title}
        </h2>
        {info ?? null}
        {action ? <span style={{ marginLeft: 'auto' }}>{action}</span> : null}
      </div>
      {why ? (
        <p
          style={{
            margin: '4px 0 12px',
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--color-ink-muted)',
            maxWidth: 620,
          }}
        >
          {why}
        </p>
      ) : (
        <div style={{ height: 10 }} />
      )}
      {children}
    </section>
  );
}

/** The mono eyebrow. Uppercase is reserved for exactly this. */
export function Eyebrow({ children, style }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-muted)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * A labelled figure.
 *
 * Light weight for the number, because at size a 300-weight numeral reads as
 * precise where 600 shouts. Direction colour applies ONLY to signed values —
 * an unsigned count in green would claim a direction it does not have.
 */
export function Stat({ label, value, sublabel, direction = null, info, size = 'md', adornment = null }) {
  const fontSize = size === 'lg' ? 28 : size === 'sm' ? 16 : 20;
  const colour =
    direction === 'gain' ? 'var(--color-gain)' : direction === 'loss' ? 'var(--color-loss)' : 'var(--color-ink)';

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 3 }}>
        <Eyebrow>{label}</Eyebrow>
        {info ?? null}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontFamily: 'var(--font-display)',
          fontSize,
          fontWeight: 300,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          color: colour,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {/* `adornment` sits BEFORE the figure — a live dot has to be read as
            a property of the number, not as decoration trailing after it. */}
        {adornment}
        <span style={{ minWidth: 0 }}>{value ?? '—'}</span>
      </div>
      {sublabel ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-ink-muted)', marginTop: 3 }}>
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A row inside a card.
 *
 * Rows are separated by a hairline and NEVER by space: gaps between rows make
 * a table look like a list of loose cards, which is exactly the choppiness
 * this pass exists to remove.
 */
export function CardRow({ children, isLast = false, tinted = false, onClick, style, ...rest }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 16px',
        border: 'none',
        borderBottom: isLast ? 'none' : '1px solid var(--color-line)',
        background: tinted ? 'color-mix(in srgb, var(--color-gold-soft) 40%, transparent)' : 'transparent',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Footer strip inside a card — totals, notes, the quiet line at the bottom. */
export function CardFooter({ children, style }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: 'var(--color-surface-raised)',
        borderTop: '1px solid var(--color-line)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--color-ink-soft)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A grid of stats sharing ONE container border, with 1px gaps revealing the
 * line colour beneath.
 *
 * Individually-bordered tiles create a visible mesh of competing edges. One
 * border with divisions reads as a single object, which is what it is.
 */
/**
 * The four headline figures, in a fixed 2x2 on a phone.
 *
 * Separate from `StatGrid` rather than a prop on it: that one flows a
 * variable number of cells and should keep doing so. This one exists
 * BECAUSE the arrangement must not vary.
 */
export function MetricGrid2x2({ children }) {
  return <div className="gati-metric-grid">{children}</div>;
}

/** A roomier cell, for figures that are the point of the screen. */
export function MetricCell({ children }) {
  return (
    <div style={{ background: 'var(--color-surface)', padding: '16px 14px', minWidth: 0, minHeight: 82 }}>
      {children}
    </div>
  );
}

export function StatGrid({ children, min = 120 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap: 1,
        background: 'var(--color-line)',
        border: '1px solid var(--color-line)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/** One cell of a StatGrid. */
export function StatCell({ children }) {
  return <div style={{ background: 'var(--color-surface)', padding: 12, minWidth: 0 }}>{children}</div>;
}
