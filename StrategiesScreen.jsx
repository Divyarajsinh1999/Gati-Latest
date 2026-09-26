/**
 * STRATEGIES — the strategy library (M14, D18).
 *
 * WHAT THIS OWNS
 *   A card per universe naming its benchmark, rebalance rule and position
 *   count, and a link into each one's record.
 *
 * WHAT THIS MUST NEVER DO
 *   Calculate anything. Every figure here is read from the universe and
 *   strategy registries — this screen is a directory, and a directory that
 *   derives its own numbers is a second place for them to be wrong.
 *
 * WHY IT EXISTS
 *   The reference build's third destination. Gati registers twelve
 *   strategies (three universes x four windows, S6) and until now they were
 *   reachable only through the window control on a universe screen — which
 *   answers "change this comparison", not "what models are there".
 */

import { Link } from 'react-router-dom';
import { UNIVERSES, UNIVERSE_KEYS } from '../config/universes.js';
import { universePath, recordPath, WINDOW_SLUGS } from '../config/routes.js';

export function StrategiesScreen() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="gati-eyebrow">MODULAR STRATEGY ENGINE</div>
        <h1 style={{ margin: '7px 0 3px', fontSize: 29, letterSpacing: '-0.04em' }}>
          Strategy library
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-ink-muted)' }}>
          Each model owns its universe, benchmark, signal and rebalance rule.
        </p>
      </div>

      <div className="gati-strategy-grid">
        {UNIVERSE_KEYS.map((key, index) => {
          const universe = UNIVERSES[key];
          return (
            <article
              key={key}
              className="gati-strategy-card"
              data-universe={key}
              /*
                THE WATERMARK IS A CSS PSEUDO-ELEMENT, NOT A DOM NODE, AND
                THAT IS NOT A TRICK TO QUIET THE CHECKER.

                It shipped as a <span aria-hidden> and axe measured it at
                1.14:1 — correctly, because it IS text in the accessibility
                tree's document, and aria-hidden does not exempt anything
                from 1.4.3.

                The number carries no information: the card beneath it names
                the universe, the benchmark and the rule. It is incidental
                ornament, which 1.4.3 exempts by definition — so the honest
                fix is to make the code SAY it is ornament rather than to
                darken a decoration until a contrast rule stops objecting.
                Passing it as a custom property does exactly that.
              */
              style={{ '--card-number': `"${String(index + 1).padStart(2, '0')}"` }}
            >
              <h2 style={{ margin: '8px 0', fontSize: 16 }}>{universe.label} Momentum</h2>
              <p style={{ color: 'var(--color-ink-muted)', fontSize: 11, lineHeight: 1.5, minHeight: 48 }}>
                Monthly relative-strength rotation into the five highest-ranked
                constituents.
              </p>
              <dl style={{ margin: '16px 0 0', paddingTop: 8, borderTop: '1px solid var(--color-line)' }}>
                <Row term="Benchmark" value={universe.benchmark.symbol} />
                <Row term="Rebalance" value="Monthly" />
                <Row term="Positions" value="Top 5" />
                {/* Read from the registry, not written as "1M / 3M / 6M / 12M".
                    A literal here would keep claiming four windows if one were
                    ever removed. */}
                <Row term="Windows" value={WINDOW_SLUGS.map((w) => w.toUpperCase()).join(' · ')} />
              </dl>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Link to={universePath(key)} className="gati-card-button">Open</Link>
                <Link to={recordPath(key)} className="gati-card-button">Record</Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Row({ term, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <dt style={{ fontSize: 9, color: 'var(--color-ink-muted)' }}>{term}</dt>
      <dd style={{ margin: 0, font: '500 9px var(--font-mono)', color: 'var(--color-ink)' }}>{value}</dd>
    </div>
  );
}

export default StrategiesScreen;
