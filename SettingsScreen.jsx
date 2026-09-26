/**
 * SETTINGS — preferences, data transparency, and everything that must exist
 * but must never interrupt.
 *
 * WHAT THIS OWNS
 *   Choices a user makes once and then stops thinking about, plus the honest
 *   account of where the numbers come from.
 *
 * WHAT THIS MUST NEVER DO
 *   Need a save button. Every control applies immediately. A settings screen
 *   with a save step invites people to change three things and lose two.
 *
 * NOTHING HERE IS PRIMARY. The screen is deliberately flat: emphasis implies
 * urgency, and none of these choices is urgent.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UNIVERSES, UNIVERSE_KEYS } from '../../config/universes.js';
import { DATA_START_DATE, TRANSACTION_COSTS } from '../../config/constants.js';
// Composed in the selector layer — screens must not import from engine/.
import { TAX_SUMMARY } from '../../selectors/recordView.js';
import { METHODOLOGY_VERSION, METHODOLOGY_HISTORY } from '../../config/methodology.js';
import { WINDOW_SLUGS } from '../../config/routes.js';
import { setPref, allPrefs } from '../../preferences/prefStore.js';
import { useDataFreshness } from '../../hooks/useDataFreshness.js';
import { useBuildInfo } from '../../hooks/useBuildInfo.js';
import { AppBar } from '../../components/layout/AppBar.jsx';
import { Button, Chip, Segmented } from '../../components/primitives/index.jsx';
import { InfoTip } from '../../components/data/index.jsx';
import { ThemeToggle } from '../../components/layout/ThemeToggle.jsx';
import { formatDate, formatDateTime } from '../../utils/formatters.js';
import { useCacheControls } from '../../hooks/useCacheControls.js';

export function SettingsScreen() {
  const navigate = useNavigate();
  const { fetchedAt, dataAsOf, providerId } = useDataFreshness();
  const [prefs, setPrefs] = useState(() => allPrefs());
  const cache = useCacheControls();

  const update = (name, value) => {
    setPref(name, value);
    setPrefs(allPrefs());
  };

  return (
    <>
      <AppBar eyebrow="SYSTEM" title="Settings" />

      <Group title="Appearance">
        <Row label="Theme">
          <ThemeToggle />
        </Row>
      </Group>

      <Group title="Investing defaults">
        <Row label="Default window" glossaryKey="lookbackWindow">
          <Segmented
            value={prefs.lastWindow}
            onChange={(v) => update('lastWindow', v)}
            options={WINDOW_SLUGS.map((slug) => ({ value: slug, label: slug.toUpperCase() }))}
          />
        </Row>

        <Row
          label="Transaction costs"
          glossaryKey="transactionCosts"
          note={`Brokerage ${pctOfTrade(TRANSACTION_COSTS.brokeragePct)}, STT ${pctOfTrade(TRANSACTION_COSTS.sttPct)}, stamp duty ${pctOfTrade(TRANSACTION_COSTS.stampDutyPct)}, slippage ${pctOfTrade(TRANSACTION_COSTS.slippagePct)}. Reasonable estimates, not your broker's exact schedule.`}
        >
          <Segmented
            value={prefs.includeCosts ? 'net' : 'gross'}
            onChange={(v) => update('includeCosts', v === 'net')}
            options={[{ value: 'gross', label: 'GROSS' }, { value: 'net', label: 'NET' }]}
          />
        </Row>

        {/*
          Directly beneath transaction costs, because they are the same kind
          of assumption and a reader setting one should see the other. Tax is
          the larger of the two for a monthly rebalance, which is why it is
          not buried further down.
        */}
        <Row
          label="Capital gains tax"
          glossaryKey="capitalGainsTax"
          note={TAX_SUMMARY}
        >
          <Segmented
            value={prefs.includeTax ? 'net' : 'gross'}
            onChange={(v) => update('includeTax', v === 'net')}
            options={[{ value: 'gross', label: 'BEFORE' }, { value: 'net', label: 'AFTER' }]}
          />
        </Row>

        <Row
          label="Investment amount"
          glossaryKey="capitalIndependent"
          note="Used only by the Investment Simulator. The strategy record never assumes an amount."
        >
          <Mono>
            {prefs.investmentAmount == null ? 'Not set' : `₹${prefs.investmentAmount.toLocaleString('en-IN')}`}
          </Mono>
        </Row>
      </Group>

      <Group title="Data and sources">
        <Row label="Provider">
          <Chip tone={providerId === 'mock' ? 'warn' : 'neutral'}>{providerId ?? 'unknown'}</Chip>
        </Row>
        <Row label="Newest price bar" glossaryKey="dataAsOf">
          <Mono>{dataAsOf ? formatDate(dataAsOf) : 'unavailable'}</Mono>
        </Row>
        <Row label="Last checked">
          <Mono>{fetchedAt ? formatDateTime(fetchedAt) : 'not yet'}</Mono>
        </Row>
        <Row label="History from">
          <Mono>{formatDate(DATA_START_DATE)}</Mono>
        </Row>

        {/*
          Constituent provenance, with the capture date shown where the config
          carries one. Indices reconstitute semi-annually, so a list that has
          aged quietly is a slow way to be wrong — its age is visible rather
          than assumed.
        */}
        {UNIVERSE_KEYS.map((key, i) => (
          <Row
            key={key}
            label={UNIVERSES[key].shortLabel}
            glossaryKey={i === 0 ? 'survivorshipBias' : undefined}
          >
            <Mono>
              {UNIVERSES[key].meta?.expectedCount ?? '—'} stocks · {UNIVERSES[key].meta?.constituentStatus ?? 'unknown'}
              {UNIVERSES[key].meta?.asOf ? ` · as of ${formatDate(UNIVERSES[key].meta.asOf)}` : ''}
            </Mono>
          </Row>
        ))}

        <Row
          label="Cached price data"
          note="Clearing removes only locally stored prices; they are re-fetched on the next load. Nothing you have entered is affected."
        >
          <Button variant="secondary" onClick={cache.clear} disabled={cache.status === 'clearing'}>
            {cache.status === 'cleared' ? 'Cleared' : cache.status === 'failed' ? 'Could not clear' : 'Clear cache'}
          </Button>
        </Row>
      </Group>

      <Group title="Methodology">
        <Row label="Version" glossaryKey="methodologyVersion">
          <Chip tone="neutral">v{METHODOLOGY_VERSION}</Chip>
        </Row>
        {METHODOLOGY_HISTORY.map((entry) => (
          <Row key={entry.version} label={`v${entry.version}`} note={entry.changed}>
            <Mono>{entry.summary}</Mono>
          </Row>
        ))}
      </Group>

      {/*
        TWO DOORS, DELIBERATELY. "How Gati works" is the plain-English tour
        for someone who does not yet know what a benchmark is; "how this is
        calculated" is the technical account for someone checking the app's
        arithmetic. Same subject, different readers — collapsing them into
        one page would fail both.
      */}
      {/*
        WHICH BUILD IS RUNNING — first, because when something looks wrong
        this is the first question, and until v1.4.0 the app could not
        answer it. A release went out where every change was present in the
        bundle and none of it appeared on screen; there was no way to tell a
        failed deploy from a stale service worker.
      */}
      <BuildPanel />

      <Group title="Understanding Gati">
        <Row label="How Gati works" note="A plain-English tour of every number in the app.">
          <Button variant="quiet" onClick={() => navigate('/how-it-works')}>Open →</Button>
        </Row>
        <Row label="How this is calculated" note="The full technical methodology, with the reasoning.">
          <Button variant="quiet" onClick={() => navigate('/methodology')}>Open →</Button>
        </Row>
        <Row label="About Gati" note="What this is, why it exists, and how to reach the developer.">
          <Button variant="quiet" onClick={() => navigate('/about')}>Open →</Button>
        </Row>
      </Group>
    </>
  );
}

/*
  ═══════════════════════════════════════════════════════════════════════
  THE VALUES IN TRANSACTION_COSTS ARE ALREADY PERCENTAGES, NOT FRACTIONS.

  This multiplied by 100 a second time, so the cost note read:

      STT 10.000%, stamp duty 1.500%, slippage 5.000%

  against real values of 0.1%, 0.015% and 0.05% — every figure a hundred
  times too large. STT at 10% of trade value is a rate no market could
  function at.

  IT WAS ONLY EVER WRONG IN THIS ONE NOTE. `calculateTradeCost` divides by
  100 correctly, so no backtest number was ever affected. That is exactly why
  it survived: the wrong figure sat in a sentence nobody reconciles against
  anything, while the arithmetic it described was right. A reader who
  believed it would have concluded costs alone made the strategy hopeless.

  Renamed from `pct`, because "pct" is what invited the fraction-versus-
  percentage confusion in the first place.
  ═══════════════════════════════════════════════════════════════════════
*/
function pctOfTrade(value) {
  return value == null ? '\u2014' : `${Number(value).toFixed(3)}%`;
}

function Group({ title, children }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
        {title}
      </h2>
      <div style={{ border: '1px solid var(--color-line)', borderRadius: 10, overflow: 'hidden', background: 'var(--color-surface)' }}>
        {children}
      </div>
    </section>
  );
}

function Row({ label, note, glossaryKey, children }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--color-ink)' }}>
          {label}
          {glossaryKey ? <InfoTip term={glossaryKey} /> : null}
        </span>
        <span style={{ marginLeft: 'auto' }}>{children}</span>
      </div>
      {note ? (
        <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-display)', fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-ink-muted)', maxWidth: 560 }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

function Mono({ children }) {
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-muted)' }}>{children}</span>;
}


/**
 * The build stamp, and a way out of a stale one.
 *
 * The reload button does more than `location.reload()`: it deletes every
 * cache and unregisters every service worker first. A plain reload is
 * answered by the same worker that was serving the old shell, which is why
 * "just refresh" does not fix this class of problem.
 */
function BuildPanel() {
  const build = useBuildInfo();

  return (
    <Group title="This build">
      <Row label="App version" note={build.builtAt ? `Built ${new Date(build.builtAt).toLocaleString()}` : null}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink)' }}>
          v{build.running}
        </span>
      </Row>

      {build.isStale ? (
        <Row
          label="A newer build is available"
          note={`The server is serving v${build.served}, but this tab is running v${build.running}. A cached copy is being shown.`}
        >
          <Button onClick={build.reload}>Load it</Button>
        </Row>
      ) : (
        <Row
          label="Serving"
          note={
            build.served
              ? 'This tab matches the build on the server.'
              : build.checked
                ? 'Could not reach the server to compare — you may be offline.'
                : 'Checking…'
          }
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-muted)' }}>
            {build.served ? `v${build.served}` : '—'}
          </span>
        </Row>
      )}

      <Row label="Force refresh" note="Clears every cache and re-downloads the app. Your saved positions are not affected.">
        <Button variant="secondary" onClick={build.reload}>Clear cache & reload</Button>
      </Row>
    </Group>
  );
}
