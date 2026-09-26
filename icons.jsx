/**
 * ICON SET — drawn, not typed.
 *
 * WHAT THIS OWNS
 *   Every icon in the interface, as geometry.
 *
 * WHAT THIS MUST NEVER DO
 *   Include the brand mark. That is supplied raster artwork and is never
 *   redrawn or regenerated from code. These are UI icons; the mark is not one.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS REPLACES THE GLYPHS
 *
 * The app previously used typographic characters as icons — a diamond, a
 * triangle, a rupee sign. Three problems, all of them visible:
 *   - they render differently on every platform, because they come from
 *     whichever font happens to resolve
 *   - they carry the font's own optical centring, so they sit wrong beside
 *     text at every size
 *   - stroke weight is whatever the typeface decided, so they cannot be made
 *     consistent with each other, let alone with a design system
 *
 * CONSTRUCTION, per the approved visual system:
 *   24 x 24 grid · 1.75px stroke · round caps and joins · outline only
 *   Stroke is REDRAWN per size band, never scaled: 1.5px at 16px, 1.75px at
 *   20-24px, 2px at 32px. Scaling an icon scales its stroke, and a 16px icon
 *   with a 1.17px stroke looks broken next to a 24px one.
 *
 * COLOUR: icons inherit `currentColor` and are never independently coloured.
 * The one exception in the whole system is the status dot, which is a shape
 * rather than an icon.
 *
 * THE THREE UNIVERSE ICONS ARE ONE FAMILY — a stepped tower, at three
 * heights. Three unrelated glyphs for three peer destinations would make the
 * primary navigation read as arbitrary. See the icons themselves for why the
 * family is read by counting courses rather than by comparing widths.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Stroke width for a given rendered size. Redrawn, not scaled. */
export function strokeFor(size) {
  if (size <= 16) return 1.5;
  if (size >= 32) return 2;
  return 1.75;
}

/**
 * Shared wrapper. `title` makes an icon accessible when it stands alone;
 * omitting it marks the icon decorative, which is correct whenever an adjacent
 * text label already names the control.
 */
function Icon({ size = 20, title, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeFor(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ---------------- Navigation: three widths of one bracket ---------------- */
// Large / mid / small caps. Same construction, one dimension apart, so the
// nav reads as a set rather than three unrelated pictures.

/**
 * THE THREE UNIVERSE ICONS — a stepped tower, read by COUNTING its tiers.
 *
 * Large has four courses, mid three, small two. The height of the structure
 * is the size of the company.
 *
 * WHY COUNTING RATHER THAN COMPARING (owner decision, 8 Aug 2026)
 * These replaced three variations on the letter H — two verticals and a
 * crossbar at three widths, which said nothing about size to anyone who
 * had not been told. The replacement had to pass one test the old set
 * failed: an icon must say which tier it is with its siblings NOWHERE ON
 * SCREEN, because that is how it appears in a screen header. A width you
 * can only judge against the other two fails that. A number of courses you
 * can count does not.
 *
 * WHY THE COURSES NARROW SHARPLY
 * The taper is what makes this a structure rather than a stack of rules —
 * and it has to be STEEP. A gentle taper was tried first (18/14/10/6) and
 * rendered in the real navigation: at 20px the three-course mid icon read
 * as a hamburger menu and the two-course small icon as an equals sign,
 * because three near-equal horizontal lines is the most overloaded glyph in
 * interface design. At 18/12/7/3 the silhouette is unmistakably a plinth.
 * The base course is common to all three, so they read as one family
 * sharing a foundation.
 *
 * NOT TO BE CONFUSED WITH IconReports, which is three VERTICAL bars of
 * differing heights. These are horizontal courses. If either is ever
 * redrawn, that distinction is the thing to preserve — they sit in the same
 * navigation bar.
 */
export const IconLargeCap = (p) => (
  <Icon {...p}>
    <path d="M3 19.5h18M6 15h12M8.5 10.5h7M10.5 6h3" />
  </Icon>
);

export const IconMidCap = (p) => (
  <Icon {...p}>
    <path d="M3 19.5h18M6 15h12M8.5 10.5h7" />
  </Icon>
);

export const IconSmallCap = (p) => (
  <Icon {...p}>
    <path d="M3 19.5h18M6 15h12" />
  </Icon>
);

export const IconReports = (p) => (
  <Icon {...p}>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </Icon>
);

export const IconSettings = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
  </Icon>
);

/* ---------------- The domain: the crossing motif ---------------- */
// A flat baseline crossed by an ascent — the mark's idea at icon scale.

export const IconRelativeStrength = (p) => (
  <Icon {...p}>
    <path d="M3 15h18" strokeDasharray="3 2.5" opacity="0.55" />
    <path d="M4 19l5-6 3.5 3L20 5" />
  </Icon>
);

export const IconBenchmark = (p) => (
  <Icon {...p}>
    <path d="M3 12h18" strokeDasharray="4 3" />
  </Icon>
);

export const IconRank = (p) => (
  <Icon {...p}>
    <path d="M6 20V9M12 20V4M18 20v-7" />
  </Icon>
);

export const IconPortfolio = (p) => (
  <Icon {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
  </Icon>
);

export const IconWindow = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Icon>
);

/* ---------------- Actions ---------------- */

export const IconChevronRight = (p) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);
export const IconChevronLeft = (p) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);
export const IconChevronDown = (p) => (
  <Icon {...p}>
    <path d="M5 9l7 7 7-7" />
  </Icon>
);
export const IconClose = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const IconSearch = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Icon>
);
export const IconRefresh = (p) => (
  <Icon {...p}>
    <path d="M20 12a8 8 0 11-2.3-5.6" />
    <path d="M20 4v4h-4" />
  </Icon>
);
export const IconDownload = (p) => (
  <Icon {...p}>
    <path d="M12 4v11M8 11l4 4 4-4M4 20h16" />
  </Icon>
);
export const IconAdd = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const IconExternal = (p) => (
  <Icon {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  </Icon>
);

/* ---------------- Status ---------------- */

export const IconMarketClosed = (p) => (
  <Icon {...p}>
    <path d="M3 12h18" />
    <path d="M20 9v6" />
  </Icon>
);
export const IconCalendar = (p) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);
export const IconOffline = (p) => (
  <Icon {...p}>
    <path d="M3 12h6M15 12h6" />
  </Icon>
);
export const IconWarning = (p) => (
  <Icon {...p}>
    <path d="M12 4l9 16H3l9-16z" />
    <path d="M12 10v4M12 17.2v.1" />
  </Icon>
);
export const IconError = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16.2v.1" />
  </Icon>
);

/**
 * The contextual-help icon (decision D9).
 *
 * Deliberately the quietest interactive mark in the interface. If a reader
 * notices these before the numbers, the size or contrast is wrong.
 */
export const IconInfo = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.8v.1" />
  </Icon>
);

/** Every exported icon, for the gallery and for coverage tests. */
export const IconLight = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
  </Icon>
);
export const IconDark = (p) => (
  <Icon {...p}>
    <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
  </Icon>
);
export const IconSystem = (p) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Icon>
);

export const ICONS = {
  IconLargeCap, IconMidCap, IconSmallCap, IconReports, IconSettings,
  IconRelativeStrength, IconBenchmark, IconRank, IconPortfolio, IconWindow,
  IconChevronRight, IconChevronLeft, IconChevronDown, IconClose, IconSearch,
  IconRefresh, IconDownload, IconAdd, IconExternal,
  IconMarketClosed, IconCalendar, IconOffline, IconWarning, IconError, IconInfo,
  IconLight, IconDark, IconSystem,
};
