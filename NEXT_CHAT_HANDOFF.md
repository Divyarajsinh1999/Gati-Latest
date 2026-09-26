# GATI — Project Handoff

**Paste this whole file into a new chat to restore full project context.**

Version: **v1.2.0-rc.1** · Release Candidate for GATI v1.0.0
Status: **Implementation complete. Frozen for owner testing.**

---

## 1 · What GATI is

A Relative Strength Momentum platform for the Indian equity market. It ranks
NSE stocks against their own index, selects the top five each month, and shows
what that strategy would have done — plus what it would do with your money.

React + Vite + Tailwind, PWA, deployed on Netlify with two serverless functions
proxying Yahoo Finance. No backend, no database, no accounts.

**"Gati" (गति) is Sanskrit for motion or momentum.**

The product exists to answer five investor questions:

1. Which stocks have the strongest momentum relative to their benchmark?
2. Which five would the strategy select?
3. How has that strategy performed, and did it beat the benchmark?
4. What would my portfolio look like?
5. Why is this stock ranked here, and what changed?

All five are answered as of v1.2.0-rc.1.

---

## 2 · Philosophy

**Transparency over complexity.** One rule, applied to published prices. No
composite scores, no proprietary models. Every rank is checkable from two
numbers the app also shows.

**Beginner-first with progressive disclosure.** Simple at first glance; depth
one tap away. Solved by layering, never by averaging — a single explanation
would fail either the beginner or the expert.

**Every screen helps the investor make one decision faster.** If an element
does not help identify, understand or act on Relative Strength Momentum, it is
simplified or removed.

**Gati never gives advice.** It states what the strategy DID — a fact that is
mechanical and checkable. "Buy this" would be unverifiable and beyond what a
Relative Strength ranking can support. This distinction is enforced by tests.

---

## 3 · The methodology

```
RS = stock return % − benchmark return %
```

Both measured over the same window, on the same dates, using split- and
dividend-adjusted closes.

- Rank the whole universe by RS at each month-end, highest first.
- Hold the **Top 5 in equal weight** until the next month-end.
- **Signal** at the last trading day's close; **execute** at the next trading
  day's open. That one-day gap is what prevents look-ahead bias.
- Month-ends come from the price series, not the calendar — so holidays resolve
  correctly with no holiday list (March 2025 ended on the 28th; March 2026 on
  the 30th).
- Four measurement windows: 1M, 3M, 6M, 12M. Only the measurement period
  changes; rebalancing stays monthly.

**Methodology version 2.0.** Stamped on every report. Version 1.0 sized the
record on whole shares; 2.0 uses exact fractional equal weights (see D1).

---

## 4 · The three universes

| Universe | Stocks | Benchmark |
|---|---|---|
| NIFTY 50 (large cap) | 50 | `NIFTYBEES.NS` |
| Midcap 150 | 150 | `NIFTYMIDCAP150.NS` |
| Smallcap 250 | 250 | `NIFTYSMLCAP250.NS` |

Each ranks against **its own** benchmark. They are never mixed, never summed —
three portfolios against three benchmarks are not addable.

Data begins **2025-01-01**.

---

## 5 · Architecture

Seven layers, dependencies flowing strictly downward. **Boundaries are
lint-enforced** — the build fails if a screen imports an engine.

```
screens/        composition only, no logic worth testing
selectors/      shape derived data; select and label, never calculate
hooks/          the ONLY sanctioned crossing point to data
engine/         pure functions: no I/O, no clock, no React
config/         dependency-free leaf: data, never behaviour
data/           fetch, normalise, cache. No domain knowledge
netlify/        serverless proxy (browser cannot call Yahoo — CORS)
```

**Key modules**

- `engine/momentum.js`, `ranking.js`, `backtestEngine.js` — the strategy
- `engine/rsHistory.js` — trailing RS, momentum age, direction
- `engine/portfolioValuation.js` — pure valuation for user holdings
- `engine/snapshots.js` + `data/cache/snapshotStore.js` — restatement audit
- `config/glossary.js` — 40 two-tier explanations, tested for house style
- `config/methodology.js` — the eleven methodology sections, versioned
- `compute/` — **deliberately unwired**, see D16

**Routes:** `/:universe`, `/:universe/3m`, `/:universe/all`, `/:universe/record`,
`/:universe/stock/:symbol`, `/reports`, `/portfolio`, `/settings`,
`/methodology`. Navigation caps at **five destinations**.

---

## 6 · Design philosophy

Palette sampled from the app mark: navy chrome, gold (benchmark/brand),
emerald (gain), red (loss). Contrast is a **build gate**, not an opinion.

**The RS Ledger is the signature component**: a solid bar for the stock, a
hatched ghost for the benchmark, sharing a centreline. The visible gap IS the
RS value. The hatching is load-bearing — two solid bars read as competing
quantities.

Icons are drawn on a 24px grid, stroke redrawn per size band, never scaled. No
typographic glyphs anywhere.

One glass hero panel per screen. Two animations in the entire app. No spinners
— skeletons only, matching final dimensions so nothing reflows.

---

## 7 · Engineering philosophy

- **Zero duplicated calculations.** One formula, one home. Two copies is how
  two screens come to disagree.
- **Engines are pure** — testable without a DOM, a clock or a network.
- **Delete as you go.** When a replacement ships, its predecessor goes.
- **`npm run verify`** runs lint → typecheck → tests → build → bundle → perf.
  Nothing is "done" until it passes.
- **1379 tests, 58 files.**

---

## 8 · Milestones M1–M12

| M | Delivered |
|---|---|
| M1 | TypeScript, lint-enforced boundaries, test harnesses, perf/bundle gates |
| M2 | Data layer: IndexedDB bar store, batched `/api/history` (251 → 8 requests) |
| M3 | Fractional weighting (D1), RS history, change detection, snapshots, compute layer |
| M4 | Design system: palette fix, 25 drawn icons, primitives, InfoTip, gallery |
| M5 | Universe-first shell, URL model, preferences, view-state restoration |
| M6 | **The universe screen** — verdict, Top 5 as the Investment Simulator |
| M7 | Full Ranking (virtualised) and Strategy Record |
| M8 | Reports, Settings, Methodology |
| — | UI/UX refinement: shared surfaces, sparklines, global search |
| M9 | Chart system: series contract, shared crosshair, D2 ranges |
| M10 | **v1.0** — production readiness, axe audit, dead-code removal |
| M11 | Manual portfolio: local storage, mandatory export |
| M12 | Stock Detail, expanded What Changed, RC1 |

---

## 9 · Decisions D1–D16 — do not reverse without explicit approval

| # | Decision |
|---|---|
| **D1** | **The historical record is capital-independent.** Exact fractional equal weights. Whole-share execution lives ONLY in the Investment Simulator. Measured: whole-share sizing reported 5.73% at ₹25,000 vs 7.89% at ₹50cr on identical signals. |
| **D2** | 3Y/5Y stay selectable; short data shows all verified history with an explicit notice. Never stretched. |
| **D3** | Portfolio is device-local, no account, no sync, **mandatory export**. |
| **D4** | Beginner-first density. Sections collapsed by default. |
| **D5** | Two measured palette corrections (both were below WCAG AA). |
| **D6** | Drawn icon set; no typographic glyphs. |
| **D7** | Completed month-ends are frozen and compared; restatements are named. |
| **D8** | TypeScript strict on new `.ts`/`.tsx`; `checkJs` off. |
| **D9** | Contextual help on every metric that could confuse. |
| **D10** | **Financial data is never fabricated, estimated, substituted or misleadingly rounded.** Restatements keep an append-only audit trail. |
| **D11** | Two-tier help (short default + Learn more). Every explanation ties back to Gati, never a textbook definition. |
| **D12** | Every universe screen answers four questions: what are the Top 5, what changed, why are these ranked here, what action follows (as STATUS, never advice). Window/filter/sort carry across universes. |
| **D13** | Momentum Age and the rebalance summary, from existing ranking history only. |
| **D14** | Momentum direction (Improving/Stable/Weakening) — descriptive, never predictive. Methodology version on every report. |
| **D15** | Six items from a UI inspiration doc were **declined**: 8-item sidebar, Command Center dashboard, Portfolio Value in the record, "Divu's Opinion" AI opinions, Portfolio Health Score, rebalance countdown. **Standing rule: approved architecture wins over any inspiration document unless the owner says otherwise.** |
| **D16** | `compute/deriveUniverse.js` + `computeScheduler.js` are retained, deliberately unwired, as the Web Worker escape hatch. **A dead-code scan will flag them — that is expected. Do not delete. Do not wire without a measured bottleneck.** |

---

## 10 · Performance philosophy

Measured, not asserted. Budgets are build gates.

```
heavy pass (250 symbols, bars)     149 ms / 250 ms
light pass (quote tick)           0.06 ms
sizing     (keystroke)            0.04 ms
index chunk                       42.8 kB / 60 kB gzip
initial payload                  120.9 kB / 200 kB gzip
```

**The heavy/light split is the single most important performance decision.**
Quotes refresh every 30s; without the split each tick would re-run a
250-symbol backtest for numbers that cannot have changed. A quote tick costs
1/2500th of a heavy pass.

Everything except the universe screen is lazily loaded. Perf gates take the
**best of 7 runs** — median proved unreliable, with up to 2.7× contention noise.

---

## 11 · Accessibility philosophy

axe-core runs across **8 screens + 3 overlays**; the build fails on any serious
or critical violation. Currently zero.

Four structural checks axe cannot make: one `h1` per screen, no skipped heading
levels, an accessible name on every control, no nested interactive controls.

Skip link, focus restoration on every dialog, 44px targets, full keyboard
traversal, reduced-motion support that loses no information.

Automated checking catches maybe a third to half of real problems. It
guarantees the mechanical third never regresses silently.

---

## 12 · Financial data integrity

**The highest-priority rule in the codebase.**

Never fabricated, estimated, interpolated, zero-filled, carried forward, or
rounded into a misleading value. Where a value cannot be verified, the app says
it is unavailable.

- No mixed adjusted/unadjusted ratios — the engine **refuses** rather than flags
- A renamed ticker is **suggested, never adopted**
- An unpriced holding is **excluded and reported**, never valued at zero (which
  fabricates a total loss) or at cost (which fabricates a break-even)
- A month with no data leaves a **gap**, never 0.0pp (which would read as
  "kept pace with the benchmark")
- Retroactive restatements are named, with the prior state kept

*An honest gap beats a plausible number. An outage is visible; a plausible
wrong figure is not.*

---

## 13 · Portfolio philosophy

The model's record describes a **rule**. A portfolio describes **one person's
money**. Blending them destroys both.

Exactly one thing crosses between them: a per-holding **status** — *In Top 5* or
*No longer in Top 5*. A test asserts no strategy figure appears on the portfolio
screen.

Device-local, no account. Positions are **migrated, never cleared** — prices are
re-fetchable, a purchase price someone typed is not. Corrupt records are dropped
and counted, never repaired. Export is mandatory because it is the only backup
that exists. The storage disclosure appears **before the first save**.

---

## 14 · Current status

**Implementation complete and frozen.** No open decisions. All gates green.

```
lint clean · typecheck clean · tests 1379 (58 files) · build clean
size PASS · perf PASS · a11y PASS
```

Verified against live Yahoo: previous month-end resolves to 2026-07-31 @
1307.80 for RELIANCE.NS, identical across repeated runs and across a three-day
gap between verification runs.

---

## 15 · What must never change without explicit approval

1. The RS formula, ranking rule, tie-breaks, or execution convention
2. Capital independence of the historical record (D1)
3. The no-fabrication rule (D10)
4. Layer boundaries and the zero-duplicate-calculation rule
5. Navigation destination count (five)
6. Any of D1–D16
7. Anything that would make Gati give advice rather than state facts

---

## 16 · Known limitations

- **Not yet verified on a real device.** Every screen is structurally verified
  and none visually. This is the largest gap between "passes" and "known good".
- **Chart geometry untested** — jsdom gives `ResponsiveContainer` zero size, so
  transforms are covered and rendered plots are not.
- **Survivorship bias** — current constituents used for historical dates,
  labelled wherever a backtest appears.
- **Short history** — data from Jan 2025, so 12M windows have few completed
  rebalances and their ratios are early reads.
- **Yahoo is unofficial** and behaves differently by IP. A second auth tier
  exists; Settings shows which is live.

---

## 17 · Future roadmap beyond v1.0

Nothing is committed. Candidates, in rough order of value:

- Additional strategies (3/6/12-month variants already exist as windows; dual
  momentum, sector rotation, moving-average filter would be new modules)
- Historical constituent lists, which would remove the survivorship caveat
- A second data provider as a cross-check
- Web Worker for the heavy pass — **only if a bottleneck is measured** (D16)
- Deeper stock detail: fundamentals, longer price history

**The immediate next step is not development.** It is the owner's real-device
testing pass. Feedback from that should be treated as targeted bug fixes and
production refinements, never as an opportunity to redesign or expand scope.

---

## 18 · Working with this project

- `npm run verify` before calling anything done
- `DECISIONS.md` — the sixteen decisions with full reasoning
- `CHANGELOG.md` — every milestone with its measurements
- `HANDOFF.md` — current state
- `REVIEW_CHECKLIST.md` — the owner's manual testing checklist
- Source comments carry the *why*; read them before changing behaviour

**If an instruction conflicts with an approved decision, say so and ask.**
Do not silently reverse a decision, and do not silently implement one either.
