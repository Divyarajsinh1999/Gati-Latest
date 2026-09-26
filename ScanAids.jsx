/**
 * SCAN AIDS — sparkline and sector badge.
 *
 * WHAT THIS OWNS
 *   Two small visual affordances that let a reader take in a 250-row ranking
 *   without reading every number.
 *
 * WHAT THIS MUST NEVER DO
 *   Introduce a calculation. Both render values that already exist: the
 *   sparkline plots closes the data layer already fetched, and the badge
 *   displays a sector already carried on every constituent.
 *
 * WHY NO CHARTING LIBRARY
 *   A sparkline is a polyline through normalised points. The charting bundle
 *   is 108 kB gzipped and lazily loaded precisely so it stays off the path to
 *   first paint; pulling it into the ranking row would undo that for a shape
 *   that takes twenty lines to draw.
 */

/** Sector → short label. Long names crowd a row and are read as noise. */
const SECTOR_SHORT = {
  'Financial Services': 'FIN',
  'Information Technology': 'IT',
  'Capital Goods': 'CAP',
  Healthcare: 'HLTH',
  Automobile: 'AUTO',
  'Automobile and Auto Components': 'AUTO',
  FMCG: 'FMCG',
  'Fast Moving Consumer Goods': 'FMCG',
  'Metals & Mining': 'METL',
  'Metals and Mining': 'METL',
  'Oil Gas & Consumable Fuels': 'ENRG',
  'Oil, Gas & Consumable Fuels': 'ENRG',
  Power: 'PWR',
  'Consumer Durables': 'DUR',
  'Consumer Services': 'SVC',
  Construction: 'CONS',
  'Construction Materials': 'MATL',
  Chemicals: 'CHEM',
  Telecommunication: 'TELE',
  Realty: 'RLTY',
  'Services': 'SVC',
  'Textiles': 'TEXT',
  'Media Entertainment & Publication': 'MEDIA',
  'Forest Materials': 'FRST',
  'Diversified': 'DIV',
};

export function shortSector(sector) {
  if (!sector) return null;
  return SECTOR_SHORT[sector] ?? sector.slice(0, 4).toUpperCase();
}

/**
 * Sector badge.
 *
 * DELIBERATELY MONOCHROME. Colour in this product means benchmark, gain, loss
 * or caution; giving twenty sectors twenty hues would either collide with that
 * vocabulary or invent a second one nobody can learn. The badge earns its
 * place by grouping, not by standing out.
 */
export function SectorBadge({ sector }) {
  const short = shortSector(sector);
  if (!short) return null;
  return (
    <span
      title={sector}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 5px',
        borderRadius: 4,
        border: '1px solid var(--color-line)',
        background: 'var(--color-surface-raised)',
        color: 'var(--color-ink-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
      }}
    >
      {short}
    </span>
  );
}

/**
 * Sparkline — the recent shape of a price, at a glance.
 *
 * NOT A CHART. There is no axis, no scale and no tooltip, because it does not
 * answer "how much" — the numeric columns beside it already do that, exactly.
 * It answers "what shape", which is the one thing a column of numbers cannot
 * convey at a glance across 250 rows.
 *
 * Normalised to its OWN range, so shape is comparable across rows while
 * magnitude deliberately is not. Two stocks that both drifted sideways look
 * alike here whatever their prices, which is the intent.
 *
 * Coloured by net direction only — first point to last. Not by the final
 * tick, which would flicker on a live refresh and mean nothing.
 */
export function Sparkline({ points, width = 56, height = 18 }) {
  if (!Array.isArray(points) || points.length < 2) return <span style={{ display: 'inline-block', width, height }} />;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min;

  // A flat line is a real answer, not a divide-by-zero. Drawing it at the
  // midpoint says "this did not move", which is true.
  const y = (v) => (span === 0 ? height / 2 : height - 1 - ((v - min) / span) * (height - 2));
  const x = (i) => (i / (points.length - 1)) * width;

  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const rising = points[points.length - 1] >= points[0];
  const stroke = rising ? 'var(--color-gain-fill)' : 'var(--color-loss-fill)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="1.6" fill={stroke} />
    </svg>
  );
}
