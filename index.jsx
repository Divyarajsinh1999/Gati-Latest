/**
 * PRIMITIVES — the smallest reusable pieces of the interface.
 *
 * WHAT THIS OWNS
 *   Buttons, chips, badges, segmented controls, fields and skeletons.
 *
 * WHAT THIS MUST NEVER DO
 *   Know anything about the domain. Nothing here has heard of a stock, a
 *   benchmark or Relative Strength. That is what makes them reusable and what
 *   keeps financial logic out of the UI.
 *
 * EVERY VALUE COMES FROM A TOKEN. No hardcoded colour, size or spacing — a
 * literal here is a value that will drift out of step with the rest of the
 * system the first time the palette changes.
 */

import { strokeFor } from '../../design/icons.jsx';

/* ------------------------------------------------------------------ */
/* BUTTON — four styles, and only four                                 */
/* ------------------------------------------------------------------ */

const BUTTON_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  height: 44,
  padding: '0 16px',
  borderRadius: 6,
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  letterSpacing: '-0.01em',
  cursor: 'pointer',
  border: '1px solid transparent',
  transition: 'background-color 120ms ease, border-color 120ms ease',
};

const BUTTON_STYLES = {
  /** The single most important action on a screen. Maximum one per screen. */
  primary: {
    background: 'var(--color-gold-fill)',
    color: 'var(--color-on-gold)',
    fontWeight: 600,
  },
  /** Alternatives. Outlined, never filled — two filled buttons compete. */
  secondary: {
    background: 'transparent',
    color: 'var(--color-ink)',
    borderColor: 'var(--color-line)',
    fontWeight: 500,
  },
  /** Onward navigation. The default for anything non-committal. */
  quiet: {
    background: 'transparent',
    color: 'var(--color-gold)',
    height: 32,
    padding: '0 4px',
    fontSize: 13,
    fontWeight: 500,
  },
  /**
   * Destructive. Outlined with loss-coloured text, NEVER a filled red button —
   * a filled red button invites the accident it warns about.
   */
  destructive: {
    background: 'transparent',
    color: 'var(--color-loss)',
    borderColor: 'color-mix(in srgb, var(--color-loss) 40%, transparent)',
    fontWeight: 500,
  },
};

export function Button({ variant = 'secondary', disabled, children, style, className, ref, ...rest }) {
  return (
    <button
      type="button"
      // React 19 passes `ref` as an ordinary prop, so no forwardRef wrapper
      // is needed. Without it a caller's ref is silently dropped — which is
      // how the exit dialog's attempt to focus its safe button did nothing.
      ref={ref}
      disabled={disabled}
      /*
        A CLASS HOOK, so a media query can reach these buttons.

        The variants below are inline style objects, which cannot express
        "only on a phone". The `quiet` variant is 32px tall — right for a
        mouse, under the 44px this project uses for anything a thumb has to
        hit, and the v1.6.5 audit found it on real phone controls
        ("Expand all" on Methodology, "How Gati works" on About). The height
        is raised on touch viewports in index.css, where a media query lives.
      */
      className={['gati-btn', `gati-btn-${variant}`, className].filter(Boolean).join(' ')}
      style={{
        ...BUTTON_BASE,
        ...BUTTON_STYLES[variant],
        ...(disabled ? { color: 'var(--color-disabled-ink)', opacity: 0.55, cursor: 'not-allowed' } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* SEGMENTED CONTROL — mutually exclusive choice                       */
/* ------------------------------------------------------------------ */

/**
 * Used for the measurement window, chart ranges and filters.
 *
 * A DISABLED SEGMENT ALWAYS STATES WHY. Silently inert controls make people
 * think the app is broken; the 3Y range with no data behind it says so rather
 * than simply refusing to respond.
 *
 * Arrow-key semantics are standard for this pattern, so keyboard users are not
 * forced to tab through every option.
 */
export function Segmented({ label, options, value, onChange, name }) {
  const activeIndex = options.findIndex((o) => o.value === value);

  const move = (delta) => {
    const enabled = options.map((o, i) => (o.disabled ? null : i)).filter((i) => i !== null);
    if (enabled.length === 0) return;
    const pos = enabled.indexOf(activeIndex);
    const next = enabled[(pos + delta + enabled.length) % enabled.length];
    onChange?.(options[next].value);
  };

  return (
    <div>
      {label ? (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-muted)',
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        role="radiogroup"
        aria-label={label ?? name}
        style={{ display: 'inline-flex', border: '1px solid var(--color-line)', borderRadius: 6, overflow: 'hidden' }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        }}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={option.disabled}
              title={option.disabled ? option.disabledReason : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => !option.disabled && onChange?.(option.value)}
              style={{
                height: 34,
                minWidth: 44,
                padding: '0 12px',
                border: 'none',
                borderRight: '1px solid var(--color-line)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                cursor: option.disabled ? 'not-allowed' : 'pointer',
                // Selected is fill + border + weight together, never colour
                // alone — colour alone fails for a colour-blind reader.
                background: active ? 'var(--color-gold-soft)' : 'transparent',
                color: option.disabled
                  ? 'var(--color-disabled-ink)'
                  : active
                    ? 'var(--color-gold)'
                    : 'var(--color-ink-muted)',
                fontWeight: active ? 600 : 500,
                opacity: option.disabled ? 0.55 : 1,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CHIP · BADGE · RANK BADGE                                           */
/* ------------------------------------------------------------------ */

const TONE_COLOURS = {
  neutral: { bg: 'var(--color-surface-raised)', fg: 'var(--color-ink-soft)' },
  gain: { bg: 'var(--color-gain-soft)', fg: 'var(--color-gain)' },
  loss: { bg: 'var(--color-loss-soft)', fg: 'var(--color-loss)' },
  warn: { bg: 'var(--color-warn-soft)', fg: 'var(--color-warn)' },
  gold: { bg: 'var(--color-gold-soft)', fg: 'var(--color-gold)' },
};

export function Chip({ tone = 'neutral', children, ...rest }) {
  const c = TONE_COLOURS[tone] ?? TONE_COLOURS.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

/**
 * Rank badge. Filled gold for the Top N, muted numeral beyond.
 *
 * RANK IS ALWAYS A NUMERAL, never conveyed by colour intensity — the number is
 * the information and the fill is only emphasis.
 */
export function RankBadge({ rank, isTop = false, size = 24 }) {
  if (rank == null) {
    return (
      <span
        style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
        aria-label="Unranked"
      >
        —
      </span>
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        background: isTop ? 'var(--color-gold-fill)' : 'transparent',
        color: isTop ? 'var(--color-on-gold)' : 'var(--color-ink-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {rank}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* FIELD                                                               */
/* ------------------------------------------------------------------ */

export function Field({ label, prefix, suffix, id, fullWidth = false, ...rest }) {
  return (
    // `fullWidth` lets a Field sit in a grid cell and fill it. The default
    // stays inline-flex so every existing caller is untouched.
    <div style={{ display: fullWidth ? 'flex' : 'inline-flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      {label ? (
        <label htmlFor={id} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
          {label}
        </label>
      ) : null}
      <div style={{ display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 12px', gap: 6, border: '1px solid var(--color-line)', borderRadius: 6, background: 'var(--color-surface)' }}>
        {prefix ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink-muted)' }}>{prefix}</span> : null}
        <input
          id={id}
          style={{
            // Fills the 44px wrapper. Sized to its content, the input was 21px
            // inside a 44px box, so the top and bottom halves of what looks
            // like the field did nothing when tapped.
            height: '100%',
            border: 'none', outline: 'none', background: 'transparent', width: '100%',
            fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-ink)', textAlign: 'right',
            // Tabular figures so a changing amount doesn't shift the caret.
            fontVariantNumeric: 'tabular-nums',
          }}
          {...rest}
        />
        {suffix ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-muted)' }}>{suffix}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SKELETON                                                            */
/* ------------------------------------------------------------------ */

/**
 * Loading placeholder.
 *
 * NO SPINNERS EXIST ANYWHERE IN GATI. A spinner says "duration unknown"; a
 * skeleton says "shape known", which is more useful and considerably calmer.
 * The dimensions must match the final element exactly, or content jumps when
 * it arrives — and perceived quality on mobile is mostly the absence of jank.
 */
export function Skeleton({ width = '100%', height = 12, radius = 6, style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'var(--color-surface-raised)',
        // Shimmer is applied via a class so it can be disabled wholesale under
        // prefers-reduced-motion, where it becomes a static fill.
        ...style,
      }}
      className="gati-skeleton"
    />
  );
}

export { strokeFor };
