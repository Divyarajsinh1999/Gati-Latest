/**
 * UNIVERSE TABS — the global filter (D18).
 *
 * WHAT THIS OWNS
 *   Switching between the three universes, from any screen that has one.
 *
 * WHAT THIS MUST NEVER DO
 *   Reset the measurement window. Comparing large, mid and small at the SAME
 *   window is the entire reason there are three (D12), so the active window
 *   carries across the switch. A strip that quietly reset to 1M would change
 *   what is being compared without saying so.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE UNIVERSE MOVED OUT OF THE NAVIGATION
 *
 * Before M14 the three universes were three nav destinations. The reference
 * build treats them as a filter instead, and it is the better model: the
 * sidebar becomes verbs — rank it, compare it, hold it, report on it — and
 * the universe becomes the noun those verbs apply to. The reader picks a
 * universe once and it follows them across screens.
 *
 * THESE ARE LINKS, NOT BUTTONS. The reference build's tabs are `<button>`s
 * flipping state, so a small-cap ranking cannot be sent to anyone. Each tab
 * here is a real destination.
 *
 * THE DOT IS THE UNIVERSE'S OWN ACCENT, and it is why this component is
 * worth having: lime, cyan and magenta appear on the nav bar, the RS pill,
 * the equity stroke and the positive bars for that universe. The dot is
 * where the reader learns what the colour means.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { NavLink } from 'react-router-dom';
import { UNIVERSES, UNIVERSE_KEYS } from '../../config/universes.js';
import { universePath } from '../../config/routes.js';
import { getPref } from '../../preferences/prefStore.js';

/**
 * @param {{ pathFor?: (key: string) => string }} props
 *   `pathFor` lets a screen keep the reader on the SAME VIEW when they switch
 *   universe — the ranking screen sends them to the other universe's ranking,
 *   not to its overview. Defaults to the universe overview.
 */
export function UniverseTabs({ pathFor }) {
  const activeWindow = getPref('lastWindow');

  return (
    <nav aria-label="Universe" className="gati-universe-tabs">
      {UNIVERSE_KEYS.map((key) => (
        <NavLink
          key={key}
          to={pathFor ? pathFor(key) : universePath(key, activeWindow)}
          className="gati-universe-tab"
          data-universe={key}
        >
          {/* Decorative: the label beside it already names the universe, so
              the dot adds colour rather than information and must not be
              announced twice. */}
          <span aria-hidden="true" />
          {UNIVERSES[key].label}
        </NavLink>
      ))}
    </nav>
  );
}
