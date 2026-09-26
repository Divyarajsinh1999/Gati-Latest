CATCH UP YOURSELF — Gati v0.20.1 (real, verified — see the numbers below)

WHAT THIS IS: Indian-market momentum dashboard, 45-section spec
(RS_Dashboard_Prompt.txt in the uploaded files). Ranks NIFTY 50, Midcap
150, Smallcap 250 by Relative Strength against their own benchmarks, Top
5 per universe, monthly-rebalance backtest. React/Vite/Tailwind PWA,
Netlify serverless functions, Yahoo Finance data. Not yet deployed with
this version — last deploy was v0.17.1 at gati2.netlify.app.

FIRST THING TO DO IN THIS CHAT: unzip the upload, run
`npm install && npm run lint && npm test && npm run build`, and confirm
349/349 tests pass, lint is clean, build succeeds. If any of those three don't hold, STOP and say so before doing
anything else — do not build on top of a broken state, and do not trust
this document's numbers over what the commands actually print. That
instruction exists because a previous session in this project's history
wrote an entire changelog describing work that was never actually saved
to disk. Verify, don't assume.

═══════════════════════════════════════════════════════════════════
THE ONE THING THAT MATTERS MOST RIGHT NOW
═══════════════════════════════════════════════════════════════════

The user reviewed a real, running build (not a mockup) and said, in
substance: "it is beautiful, it is good, but it's really not good from a
user perspective — too messy, too choppy." They are about to give a
detailed restructuring prompt in THIS chat.

Read that feedback precisely:
- The DESIGN SYSTEM is not what's being criticized — the palette sampled
  from the app icon (gold=benchmark/brand/rank, emerald=ahead,
  red=behind, navy=chrome), the dark/light/system theming, the RS Ledger
  (the signed bar-vs-hatched-benchmark component), Urbanist + JetBrains
  Mono — none of that was flagged as wrong. Don't discard it pre-emptively.
- What's being criticized is almost certainly PAGE-LEVEL COMPOSITION:
  too much competing for attention at once, unclear reading order, pages
  built component-by-component without ever being looked at as a whole
  screen. That is a real and identifiable failure mode: a hero panel, a
  window switcher, a notice, three metric groups, a big table, and a
  legend can all individually be "correct" and still add up to a page
  that doesn't know what it's asking the reader to look at first.

DO NOT guess at the fix and start rebuilding before the user's detailed
prompt arrives in this chat. If it arrives vague, ask targeted questions
rather than reinterpreting it into whatever seems easiest. This is
explicitly flagged in HANDOFF.md's banner too — read that in full before
touching any component.

Practical instruction for whenever redesign work does start: actually
load the app and look at it — `npm run dev`, or the included
`gati-app-preview.html` (a self-contained single-file build, see below)
— screen by screen, at both mobile and desktop widths, BEFORE writing
new component code. Assembling pieces without ever stepping back to view
the whole is exactly how this got messy the first time.

═══════════════════════════════════════════════════════════════════
CURRENT STATE — v0.20.1, verified
═══════════════════════════════════════════════════════════════════

npm run lint    → clean
npm test        → 349/349 passing
npm run build   → succeeds, PWA precache 15 entries / ~807 KiB

Everything below is REAL, on disk, in this zip — not documentation of
intended work. Every prior session that made a claim about shipped code
in this project either verified it with these three commands or had that
claim later found to be false. Keep it that way.

WHAT'S ACTUALLY BUILT:

1. ENGINE (Phase 1-2, closed, unchanged for many versions): Relative
   Strength = stock return % − benchmark return %, monthly rebalance,
   Top 5 equal-weight, whole-share flooring, look-ahead-safe execution
   (signal at month-end close, entered at next day's open), transaction
   costs wired and toggleable, three historical financial-accuracy bugs
   found and fixed long ago (see CHANGELOG v0.5.0/v0.8.0/v0.10.0).

2. TWELVE STRATEGIES (Phase 4, v0.18.0, verified for real after an
   earlier session's "v0.18.0" turned out to be pure fiction — see
   CHANGELOG v0.18.0's own opening note for that story, worth reading
   once so it isn't repeated). 1/3/6/12-month RS rules × 3 universes.
   The 1-month rule keeps the bare universe key as its route
   (/strategy/nifty50); longer windows get a suffix
   (/strategy/nifty50-rs-3m etc). A 12-month window currently has a thin
   sample (~7 rebalances since Jan 2025 data start) and the app SAYS so
   via `assessHistorySufficiency` / `InsufficientHistoryNotice` — this
   is a known, deliberate, surfaced limitation, not a bug.

3. DESIGN SYSTEM (v0.19.0). Palette sampled from the user's actual app
   icon (brand-src/LOGO.png) — not invented. Read the header comment in
   src/index.css for the full token contract; two traps documented
   there and worth internalizing before editing any component:
     - --color-ink is TEXT, inverts to near-white in dark mode. Using it
       as a background renders white-on-white (this exact bug shipped
       once in Sidebar.jsx and was fixed).
     - white text on --color-gold-fill is ~3.2:1, fails WCAG AA. Use
       --color-on-gold (~9:1) for anything sitting on a gold fill.
   No component carries a `dark:` variant anywhere — both themes are the
   same token names, re-declared under [data-theme="dark"]. Recharts is
   the one exception (writes raw SVG attributes, doesn't read CSS) —
   goes through components/charts/chartTheme.js instead.

4. THE SIGNATURE COMPONENT: the RS Ledger (RankingTable.jsx). Draws BOTH
   operands of Relative Strength — the stock's return as a solid bar, the
   benchmark's return as a hatched ghost bar, both from one shared
   centreline. The visible gap between them IS RS. This was explicitly
   approved by the user in the mockup phase and not part of the "too
   messy" complaint (though ask again once their detailed prompt is in,
   to be sure).

5. REAL APP ICON (v1.2.0, artwork v2). scripts/generate-icons.py derives
   the whole PWA icon set from brand-src/LOGO.png (owner-supplied 948x944
   render, NOT code-generated — an earlier code-generated identity was
   fully retired and deleted, generators included). Three numbers live in
   that script rather than in memory: the measured crop box separating
   the card from its presentation staging, the card's own corner radius
   ratio (0.18), and the maskable safe-area scale (0.63). The artwork has
   a thin gold rule tracing the card's outline, so the maskable variants
   must fit the WHOLE CARD inside Android's 80%-diameter safe circle, not
   just the mark; the script derives the bound and asserts it. Guard
   tests in config/__tests__/icons.test.js assert the maskable files are
   literally different bytes from the standard ones, and that every
   absolute image path in src/ resolves to a file in public/ — the second
   check exists because Navigation.jsx shipped a broken /gati-mark.png
   path through several green milestones.

6. LAYOUT PASS (v0.20.0-0.20.1) — the thing now being reconsidered.
   HeroPanel (one glass surface per page, gold+emerald glow matching the
   icon's own lighting), MetricGroup (13 flat stat cards regrouped into
   Performance/Risk/Consistency), phone card view for rankings (the
   desktop table has 11 columns and doesn't survive a 390px screen),
   Dashboard hero counting universes beating their benchmark. This is
   the layer under review — see the banner above.

7. PREVIEW TOOLING: vite.config.preview.js + src/main.preview.jsx +
   scripts/build-preview.py produce a SINGLE self-contained HTML file
   (gati-app-preview.html, likely included in this zip) that opens with
   no server, running on VITE_DATA_PROVIDER=mock so it needs no network
   either. Built to let the user actually click through the real app
   rather than look at a static mockup. This shipped broken twice before
   it worked (BrowserRouter renders blank outside a normal web root with
   NO console error; the icon inliner missed a minifier's quote-style
   rewrite) — both fixes are recorded in CHANGELOG v0.20.1 and the
   script now asserts its own output before finishing. If you regenerate
   it: `VITE_DATA_PROVIDER=mock npx vite build --config
   vite.config.preview.js && python3 scripts/build-preview.py`. This
   tooling is separate from the real vite.config.js / index.html and
   cannot affect an actual deployment.

═══════════════════════════════════════════════════════════════════
STANDING RULES — do not relitigate, do not violate
═══════════════════════════════════════════════════════════════════

- Never fabricate market data on a fetch failure — an explicit error
  notice, full stop, no synthetic fallback (a deliberate instruction,
  not an oversight — see CHANGELOG v0.14.4 if the reasoning is unclear).
- Never auto-adopt a guessed replacement for a renamed/delisted ticker —
  flag and suggest, never silently substitute.
- Per-symbol tolerance: one bad stock ≠ universe failure. Benchmark
  failure or all-stocks failure = universe-wide error (different causes,
  different fixes, must stay visually distinct).
- Do NOT deliver zip files / downloads unless the user explicitly asks.
  Keep the project on disk, iterate version on version, report progress
  in text. (This chat's zip is an explicit exception, asked for by name.)
- Work autonomously through TODO.md in priority order; only stop to ask
  when a real product decision or genuine blocker requires it — not for
  permission to keep going.
- Every change: verify with `npm run lint && npm test && npm run build`
  BEFORE reporting it as done, bump the version, update CHANGELOG.md,
  update TODO.md. If a requirement is financially or visually ambiguous
  enough that guessing could waste real effort, ask first.
- Palette meanings are fixed, not decorative: gold ONLY means benchmark,
  brand, or rank. Green/red ONLY on signed values. Breaking this makes
  the UI actively lie about what a colour means.

═══════════════════════════════════════════════════════════════════
READ THE UPLOADED FILES IN THIS ORDER
═══════════════════════════════════════════════════════════════════

1. This file (you're reading it)
2. HANDOFF.md — has the full ⚠️ banner on the UX feedback, plus the
   design-system contract in detail
3. TODO.md — the UX restructure is now the top item under "Blocked",
   waiting on the user's detailed prompt
4. CHANGELOG.md — v0.20.1 down to v0.16.0 covers everything described
   above with full technical detail and exact verified numbers
5. ROADMAP.md — phase sequencing, mostly unchanged, Phase 4 section is
   now stale (says "awaiting a decision" — decision was made, see
   CHANGELOG v0.18.0) — worth a quick tidy pass if you're in there anyway
   but not urgent
6. RS_Dashboard_Prompt.txt — the original 45-section spec, for anything
   ambiguous

═══════════════════════════════════════════════════════════════════
IMMEDIATE NEXT STEPS
═══════════════════════════════════════════════════════════════════

1. `npm install && npm run lint && npm test && npm run build`. Confirm
   349/349, clean, clean. If anything differs from this document, trust
   the terminal, say so, and stop.
2. Wait for the user's detailed restructuring prompt. Do not pre-empt it.
3. If useful for orienting on what "messy" might mean concretely, open
   gati-app-preview.html (if included) or run `npm run dev` and look at
   the Dashboard and a Strategy page yourself, at both mobile and
   desktop widths, before the user's prompt arrives — so you're ready to
   engage with specifics rather than starting cold.
4. Once the restructure prompt is in hand: identify what from the
   existing design system genuinely serves it (very likely: tokens,
   theming, RS Ledger, icon) versus what needs to change (very likely:
   page composition, density, visual hierarchy) — and say which is
   which before writing code, so the user can correct the plan cheaply
   instead of after a rebuild.
