import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SPLASH_BACKGROUND,
  SPLASH_LOGO_SRC,
  SPLASH_LOGO_SIZE,
  SPLASH_TIMING,
  SPLASH_TIMING_REDUCED,
  SPLASH_EASING,
  splashTotalDuration,
  splashFadeStart,
  splashBootstrapContract,
} from '../splash.js';

const root = (p) => resolve(process.cwd(), p);
const indexHtml = readFileSync(root('index.html'), 'utf8');
const viteConfig = readFileSync(root('vite.config.js'), 'utf8');
const splashCss = readFileSync(root('src/index.css'), 'utf8');

describe('splash timing', () => {
  it('completes its animation inside the 1.2–1.5s brief', () => {
    const animationEnd = Math.max(
      SPLASH_TIMING.sweepDelay + SPLASH_TIMING.sweepDuration,
      SPLASH_TIMING.glowDelay + SPLASH_TIMING.glowDuration,
    );
    expect(animationEnd).toBeGreaterThanOrEqual(1200);
    expect(animationEnd).toBeLessThanOrEqual(1500);
  });

  it('starts the fade exactly one fade-length before the end', () => {
    expect(splashTotalDuration(SPLASH_TIMING) - splashFadeStart(SPLASH_TIMING)).toBe(
      SPLASH_TIMING.fadeOut,
    );
  });

  it('overlaps the halo with the tail of the sweep rather than queueing it after', () => {
    // Two gestures read as one. Sequenced, they read as two events and the
    // splash feels a beat longer than it is.
    expect(SPLASH_TIMING.glowDelay).toBeLessThan(
      SPLASH_TIMING.sweepDelay + SPLASH_TIMING.sweepDuration,
    );
  });

  it('holds the finished mark before leaving — no cut straight from motion to app', () => {
    expect(SPLASH_TIMING.hold).toBeGreaterThan(0);
    expect(SPLASH_TIMING.fadeOut).toBeGreaterThan(0);
  });

  /**
   * The whole point of a launch animation is that it is over quickly. A
   * splash the owner has to sit through on every reload stops being an
   * identity and starts being a toll.
   */
  it('is over in under two and a half seconds, total', () => {
    expect(splashTotalDuration(SPLASH_TIMING)).toBeLessThan(2500);
  });
});

describe('reduced motion', () => {
  it('is a complete alternative, not a truncated one — it still holds and fades', () => {
    expect(SPLASH_TIMING_REDUCED.hold).toBeGreaterThan(0);
    expect(SPLASH_TIMING_REDUCED.fadeOut).toBeGreaterThan(0);
  });

  it('has no sweep and no glow at all', () => {
    expect(SPLASH_TIMING_REDUCED.sweepDuration).toBe(0);
    expect(SPLASH_TIMING_REDUCED.glowDuration).toBe(0);
  });

  it('is meaningfully shorter than the full sequence', () => {
    expect(splashTotalDuration(SPLASH_TIMING_REDUCED)).toBeLessThan(
      splashTotalDuration(SPLASH_TIMING),
    );
  });

  it('hides every animated layer, so nothing is left mid-transform', () => {
    // The layers are display:none under --still rather than merely
    // unanimated: an unanimated .lit sits at its `from` transform, three
    // stage-widths off to the side, which is invisible but still composited.
    expect(splashCss).toMatch(/\.gati-splash--still[\s\S]*?display:\s*none/);
  });
});

describe('easing', () => {
  it('has no overshoot — both control points stay inside the unit square', () => {
    const [, x1, y1, x2, y2] = SPLASH_EASING.match(
      /cubic-bezier\(([^,]+),([^,]+),([^,]+),([^)]+)\)/,
    ).map(Number);
    for (const value of [x1, y1, x2, y2]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * THE DUPLICATION CONTRACT.
 *
 * The splash background exists in three places that cannot import each
 * other: this config, an inline <style> that must apply before first paint,
 * and the PWA manifest, which Android reads before any of this app runs.
 * Drift between them is invisible in every desktop preview and shows up as
 * a flash on a phone — which is precisely the failure the splash exists to
 * prevent, so it gets a test rather than a comment.
 */
describe('splash bootstrap contract', () => {
  const contract = splashBootstrapContract();

  it('index.html paints the same background this config declares', () => {
    expect(indexHtml).toContain(contract.background);
  });

  it('index.html keys that background on the attribute the hook removes', () => {
    expect(indexHtml).toContain(`${contract.attribute}='${contract.activeValue}'`);
    expect(indexHtml).toContain(`'${contract.attribute}', '${contract.activeValue}'`);
  });

  it("the manifest's background_color matches, so Android's own splash does not flash", () => {
    expect(viteConfig).toContain(`background_color: '${SPLASH_BACKGROUND}'`);
  });

  it('index.html preloads the exact asset the component renders', () => {
    expect(indexHtml).toContain(`rel="preload" as="image" href="${contract.logoSrc}"`);
  });
});

describe('splash asset', () => {
  const asset = root(`public${SPLASH_LOGO_SRC}`);

  it('exists where the config and the preload both point', () => {
    expect(existsSync(asset), `${SPLASH_LOGO_SRC} is missing — run scripts/generate-icons.py`).toBe(
      true,
    );
  });

  it('is a real WebP, not a renamed PNG', () => {
    const head = readFileSync(asset).subarray(0, 12);
    expect(head.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(head.subarray(8, 12).toString('ascii')).toBe('WEBP');
  });

  /**
   * This asset is fetched on the critical path of the first paint, before a
   * service worker exists to cache anything. The PNG of the same artwork is
   * 541 kB; that is the mistake this number guards against.
   */
  it('stays light enough to sit on the first paint', () => {
    expect(statSync(asset).size).toBeLessThan(80 * 1024);
  });

  it('is precached, so a cold offline launch does not show an empty frame', () => {
    expect(viteConfig).toContain('brand/gati-splash.webp');
  });
});

describe('responsive sizing', () => {
  it('caps on the narrow axis, the short axis, and an absolute ceiling', () => {
    // A single clamp rather than breakpoints: foldables and split-screen
    // windows land somewhere sensible without having been enumerated.
    expect(SPLASH_LOGO_SIZE).toContain('vw');
    expect(SPLASH_LOGO_SIZE).toContain('vh');
    expect(SPLASH_LOGO_SIZE).toMatch(/\d+px/);
  });

  it('holds the mark square, so it can never stretch', () => {
    expect(splashCss).toMatch(/\.gati-splash__stage[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * LAUNCH SCALE, NOT POSTER SCALE (owner, 29 Aug 2026).
   *
   * The checks above only describe the SHAPE of the value — three terms with
   * the right units — so they passed just as happily at 56vw / 320px, which
   * put the mark across 56% of every phone screen. The owner read that as
   * oversized, correctly.
   *
   * These assert the actual rendered size instead, at real device viewports.
   * The band is drawn from what native launch screens do: roughly a quarter
   * to a third of the narrow axis on a phone, and a fixed ~128px on desktop
   * where a percentage would turn a signature into wall art.
   * ═══════════════════════════════════════════════════════════════════════
   */
  const resolve = (vw, vh) =>
    Math.min(
      ...SPLASH_LOGO_SIZE.replace(/^min\(|\)$/g, '')
        .split(',')
        .map((term) => {
          const n = parseFloat(term);
          if (term.trim().endsWith('vw')) return (n * vw) / 100;
          if (term.trim().endsWith('vh')) return (n * vh) / 100;
          return n;
        }),
    );

  it.each([
    ['iPhone SE', 320, 568],
    ['iPhone 14', 390, 844],
    ['Pro Max', 430, 932],
  ])('takes a quarter to a third of the width on %s', (_name, w, h) => {
    const share = resolve(w, h) / w;
    expect(share).toBeGreaterThanOrEqual(0.2);
    expect(share).toBeLessThanOrEqual(0.34);
  });

  it('never exceeds a native-sized mark on a large monitor', () => {
    // 320px read as artwork the user was meant to study. A splash should be
    // noticed once and then get out of the way.
    expect(resolve(1440, 900)).toBeLessThanOrEqual(160);
    expect(resolve(2560, 1440)).toBeLessThanOrEqual(160);
  });

  it('stays comfortably inside a short landscape window', () => {
    // 844x390 — a phone on its side. The height term has to win here, or the
    // mark touches both edges of the stage.
    expect(resolve(844, 390)).toBeLessThanOrEqual(390 * 0.3);
  });

  it('is still large enough to be legible on the smallest phone', () => {
    // The other failure direction: a mark so small it reads as a favicon.
    expect(resolve(320, 568)).toBeGreaterThanOrEqual(72);
  });
});

/**
 * The performance claim, asserted rather than believed.
 *
 * The sweep is built out of counter-translations specifically so that no
 * frame needs layout or paint. `mask-position` would have been simpler to
 * write and would have repainted the masked element every frame — reaching
 * for it later is the regression this test exists to catch.
 */
describe('compositor-only animation', () => {
  const block = splashCss.slice(splashCss.indexOf('LAUNCH SPLASH'));

  it('animates nothing but opacity and transform', () => {
    const animated = [...block.matchAll(/@keyframes\s+gati-splash-[\w-]+\s*\{([\s\S]*?)\n\}/g)]
      .flatMap(([, body]) => [...body.matchAll(/([a-z-]+)\s*:/g)].map(([, prop]) => prop));

    expect(animated.length).toBeGreaterThan(0);
    for (const property of animated) {
      expect(['opacity', 'transform'], `@keyframes animates ${property}`).toContain(property);
    }
  });

  it('never sweeps the mask by moving the mask itself', () => {
    expect(block).not.toMatch(/animation[^;]*mask-position/);
    expect(block).not.toMatch(/@keyframes[\s\S]*?mask-position/);
  });

  it('moves the window and the artwork by equal and opposite distances', () => {
    /**
     * Not a string match on the numbers — the arithmetic itself, in stage
     * widths. If a future tweak changes the wrapper width without changing
     * both translations to match, the mark slides across the screen during
     * the sweep, and that is far easier to ship than to notice.
     */
    const num = (re) => Number(block.match(re)[1]);

    const wrapperWidth = num(/\.gati-splash__lit\s*\{[\s\S]*?width:\s*([\d.]+)%/) / 100;
    const wrapperShift = num(/gati-splash-window\s*\{[\s\S]*?translate3d\(-([\d.]+)%/) / 100;
    const artWidth = num(/\.gati-splash__lit-art\s*\{[\s\S]*?width:\s*([\d.]+)%/) / 100;
    const artShift = num(/gati-splash-art\s*\{[\s\S]*?translate3d\(([\d.]+)%/) / 100;

    // Percentages resolve against each element's OWN width.
    const wrapperTravel = wrapperWidth * wrapperShift;
    const artTravel = wrapperWidth * artWidth * artShift;

    expect(artTravel).toBeCloseTo(wrapperTravel, 6);
    expect(wrapperTravel).toBeGreaterThan(1); // the edge must clear the mark entirely
  });

  it('spends the whole sweep crossing the mark, with no dead travel', () => {
    /**
     * The first version was geometrically correct and visually wrong: with
     * the mark at a quarter of the wrapper, the soft edge crossed it in
     * roughly 180ms of a 900ms sweep and the rest was dead air. Rendered
     * frames caught it. These bounds keep the mark occupying enough of the
     * wrapper that the reveal fills the duration.
     */
    const wrapperWidth =
      Number(block.match(/\.gati-splash__lit\s*\{[\s\S]*?width:\s*([\d.]+)%/)[1]) / 100;
    const artFraction =
      Number(block.match(/\.gati-splash__lit-art\s*\{[\s\S]*?width:\s*([\d.]+)%/)[1]) / 100;

    expect(wrapperWidth * artFraction).toBeCloseTo(1, 6); // the art is exactly one stage wide
    expect(artFraction).toBeGreaterThanOrEqual(0.33);
  });

  it('runs the specular band on the same clock as the reveal edge', () => {
    // Different durations or easings and the light drifts off the edge it
    // is supposed to be creating.
    const glint = block.slice(block.indexOf('.gati-splash__glint-band'));
    expect(glint).toContain('var(--splash-sweep-duration)');
    expect(glint).toContain('var(--splash-ease)');
    expect(glint).toContain('var(--splash-sweep-delay)');
  });
});
