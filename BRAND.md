# Gati — identity

**गति** (Sanskrit): motion, pace, momentum.

## Provenance

The mark is **finished artwork supplied by the owner** (v2, 8 Aug 2026),
held at `brand-src/LOGO.png`. It is the single source of the identity.

Everything below describes what the artwork *is* and how it is processed
into shipped assets. It deliberately does **not** invent a design
rationale — the intent behind the mark belongs to whoever drew it, and a
plausible-sounding story written after the fact is exactly the kind of
thing this project doesn't do.

## What the artwork contains

A rounded-square card on near-black navy, edged with a thin gold rule,
carrying a gold Devanagari-derived letterform with a spiral terminal, an
emerald vertical stroke, and a gold-and-emerald zigzag ascending to the
upper right. A warm gold glow washes in from the top-right corner, inside
the card and again outside it.

The glow **outside** the card is presentation staging, not the icon. An
app icon containing a smaller rounded card inside the OS's own rounded
tile reads as an amateur mistake, so every generated asset crops to the
card and lets it fill the tile.

## The gold rule is load-bearing

This is the one fact that changes how the assets are built.

The previous artwork had no visible border, so clipping a corner cost a
few pixels of navy and nobody could see it. This artwork's gold rule
traces the card's own outline. Clip a corner now and you ship a gold ring
with a bite out of it — visibly wrong, on a home screen, forever.

Two consequences, both enforced in code:

1. **The corner mask must match the artwork's own radius.** Measured by
   fitting the border contour: ~165px on a 930px card, i.e. **0.18**.
   A larger radius shaves the rule; a smaller one leaves stray corners.
   This applies to the CSS `border-radius` on the inline mark too, which
   is why `AppBar` uses 4px at 24px and `Navigation` 5px at 28px.
2. **The maskable variants must fit the whole card, not just the mark.**
   Android crops a `maskable` icon to a circle of 80% diameter. A rounded
   square of side `s` with radius `0.18s` reaches `sqrt(2)·(s/2 − 0.18s) + 0.18s
   = 0.6326s` from its centre, so `0.6326s ≤ 0.40T` gives `s ≤ 0.632T`.
   **`MASKABLE_SCALE` is 0.63**, down from the previous artwork's 0.78.
   That is not a regression — 0.78 was right for artwork with nothing at
   its corners worth protecting. The script asserts the derivation.

## Raster, deliberately

The current mark is **raster, not vector**, and that is a trade rather
than an oversight. The artwork carries a gradient ground, a soft glow and
bevelled strokes; a hand-trace would approximate it and drift from what
was approved. Sizes are generated from the 948×944 master, which covers
every size the app requests. A genuinely resolution-free mark, if ever
needed for print or embroidery, is a redraw commissioned against this
artwork — not something to fake by upscaling.

## Regenerating the assets

```bash
python3 scripts/generate-icons.py brand-src/LOGO.png   # needs Pillow
```

Every measured number — crop box, radius ratio, maskable scale, the navy —
lives in that script with its derivation, not in anyone's memory.

| File | Use |
|---|---|
| `icon-192.png`, `icon-512.png` | PWA manifest, `purpose: any` |
| `icon-maskable-192/512.png` | PWA manifest, `purpose: maskable` |
| `apple-touch-icon.png` | iOS home screen (180px) |
| `favicon-32.png` | browser tab |
| `gati-mark.png` | bare mark, transparent corners — app bar and sidebar |

The generator also writes `brand-src/gati-master-card.png` — the card
squared up, before sizing. It is an **intermediate for eyeballing a new
master** and deliberately lives outside `public/`: the PWA `includeAssets`
glob sweeps `icons/*.png` and the service worker precaches every match, so
a 1 MB working file left there becomes 1 MB on every install.

Guarded by `src/config/__tests__/icons.test.js`: the files exist, are real
PNGs, are not truncated, the maskable pair is genuinely different bytes,
**every absolute image path in `src/` resolves to a file in `public/`**
(icon paths in components are plain strings, not ESM imports, so nothing
else in the build fails when one is wrong), and **`public/icons` holds
nothing but the shipped set**. Both of those last two were added in
v1.2.1, each after the bug it catches had already shipped.

## Colour

The app's tokens were sampled from the **first** artwork and are unchanged.
The new mark sits inside the same families — its gold reads `#e8ab42`
against `--color-gold-fill` `#d8ae55`, its emerald `#02895f` against
`--color-gain` `#0a7049` — so no token moved. Its navy is darker than
`--color-chrome` (`#030f1e` vs `#0e1b2c`); the icon keeps the artwork's own
value so repainted corners match the card exactly, while the app chrome
keeps the contrast-tested token.

Gold means benchmark, brand and rank; emerald means ahead of the benchmark;
red means behind it. See the header of `src/index.css`.

## Superseded: the code-generated identity (v0.16.0 – v0.19.0)

Gati's first mark was generated from code in `brand-src/` — a baseline
crossed by an accelerating ascent, with a *shirorekha* reference. It was
retired when the owner supplied finished artwork, and the generators
(`build_mark.py`, `build_lockup.py`, `export_assets.py`) and the identity
sheet were **removed in v1.2.0** so that no future session can regenerate
a rejected mark by running a script that still happens to work.
The reasoning is preserved in `CHANGELOG.md`.
