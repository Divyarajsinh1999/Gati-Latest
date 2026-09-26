# DECISIONS

The record of every decision that changes a number, a screen, or a code path.

**Why this file exists.** Phases 1–5 surfaced decisions that were repeatedly
deferred and would otherwise get resolved silently by whoever wrote the line.
Each entry below is stated once, dated, and never relitigated. If a future
session wants to change one, it supersedes the entry here rather than quietly
doing something different.

**Status values:** `PROPOSED` (recommendation recorded, owner has not confirmed)
· `ACCEPTED` (confirmed, safe to build on) · `SUPERSEDED` (with a pointer).

---

## M0 — the eight gating decisions

### D1 · Weighting basis for the strategy record
**Status: ACCEPTED — 3 Aug 2026 (owner).** Modified Option (d).
**Source:** Phase 2 A1, Phase 4 §4.9 · **Blocks:** M3, every historical number

**THE DECISION**

The Historical Strategy Engine **always** uses exact fractional equal-weight
allocations — 20% in each of the Top 5 — so every published historical metric
is capital-independent, mathematically consistent, and comparable over time.
**Gati never assumes a default investment amount or account size when
presenting historical strategy performance.**

Whole-share constraints, leftover cash, idle capital and cash drag are real
execution effects, and they live **only** in the **Investment Simulator**
(renamed from "Calculator" — see S11). Once the user enters their own amount,
the Simulator computes the real executable portfolio with whole-share
quantities and displays idle cash, execution efficiency, cash drag, and the gap
between the ideal strategy return and the user's actual executable return.

Strategy evaluation and execution simulation are two separate concepts and are
kept as two separate code paths.

**THE EVIDENCE** — the current engine, unchanged, over one identical set of
signals, varying only the assumed capital:

| Capital | Reported return | Avg idle cash | Worst month idle |
|---|---|---|---|
| ₹25,000 | 5.7321% | 20.57% | 30.93% |
| ₹50,000 | 6.9958% | 8.84% | 15.17% |
| ₹1,00,000 | 7.5896% | 5.03% | 8.97% |
| ₹5,00,000 | 7.7549% | 1.08% | 1.67% |
| ₹50,00,000 | 7.8759% | 0.08% | 0.15% |
| ₹50 crore | 7.8875% | 0.00% | 0.00% |

A 2.15pp spread from capital alone. The figures converge on 7.8875% as flooring
error vanishes; that converged number is the fractional-weight answer.

**Acceptance test:** the record's percentage return must be invariant to the
notional. If it moves, fractional weighting is not wired in.

Phase 1 decision 4 removed the ₹50,000 assumption and requires historical
strategy performance to be capital-independent. The current engine sizes
positions with `Math.floor(allocation / entryPrice)`, so a stock at ₹3,500 in a
₹10,000 slot buys 2 shares and leaves 30% of that slot in cash. **That makes the
reported percentage return depend on the notional capital** — ₹50,000 and
₹5,00,000 produce different returns from identical signals.

**Recommendation:** the strategy record uses **exact fractional equal weights
(1/N per pick, no cash drag)**. Whole-share flooring is retained **only** in the
sizing calculator, where it is real and correct. Two named, separately-tested
sizing paths that can never be confused.

**Acceptance test:** the record's percentage return must be invariant to the
notional passed in. If it changes, fractional weighting is not actually wired in.

---

### D2 · Chart ranges against a 2025-01-01 data start
**Status:** PROPOSED · **Source:** Phase 2 A3 · **Blocks:** M9

Phase 1 decision 7 requires 3M / 6M / 1Y / 3Y / 5Y / All. With history starting
2025-01-01, the 3Y and 5Y ranges have no data behind them and would be identical
to *All*.

**Recommendation:** ship all six. **Ranges exceeding available history render
disabled with an inline reason** ("Needs data before Jan 2025") — never hidden,
never silently equal to *All*. If `DATA_START_DATE` moves back later, the
disabled states simply stop appearing; zero rework.

**Related open question (not part of D2):** whether to move `DATA_START_DATE`
back to ~2023. Real fetch-cost implications across 453 symbols. Deferred; see
the carried-forward backlog in `TODO.md`.

---

### D3 · Manual portfolio storage
**Status: ACCEPTED — 4 Aug 2026 (owner).** Stated directly in the M11 brief:
portfolio data stays "local, lightweight, private, and fully independent from
the historical strategy calculations."
**Source:** Phase 2 A4 · **Blocks:** M11

**Recommendation:** device-local, no account, no cloud sync (Phase 1 §42 forbids
auth and sync). Positions entered per stock, surfaced inside the universe that
stock belongs to, aggregated **globally** in Reports → My Portfolio.

**Non-negotiable consequences:**
- A one-time storage disclosure is shown **before** the first save, not after.
- **JSON export/import is mandatory, not optional.** Device-local storage with
  no export path is a data-loss trap, and it is also the only rollback path if a
  schema migration ever fails.

---

### D4 · Density baseline
**Status:** PROPOSED · **Source:** Phase 2 A5 · **Blocks:** M6 onward

**Recommendation:** **beginner-first.** Default disclosure depth is set for the
beginner persona; the active investor is served by one extra tap; the quant is
served by layering, never by raising the default density.

This is the decision that would cause the most rework if answered differently —
it sets the default state of every collapsed section in the product.

---

### D5 · Palette corrections
**Status:** PROPOSED · **Source:** Phase 3 §5.1 · **Blocks:** M4

Two light-mode accent tokens measure **below** the WCAG AA 4.5:1 floor against
their own soft backgrounds. Both pairings are high-traffic (every selected
segment, every preset chip, every positive chip).

| Token | Was | Now | Measured |
|---|---|---|---|
| `--color-gold` | `#8a6a1f` | `#7d601b` | 4.40 → **5.14** on `gold-soft` |
| `--color-gain` | `#0b7d52` | `#0a7049` | 4.45 → **5.29** on `gain-soft` |

**Recommendation:** apply both. Hue and character are unchanged; the values are
visually indistinguishable in isolation. `loss` (5.00) and `warn` (4.95) already
pass and are untouched. Dark mode passes everywhere and is untouched.

Also add a `--color-disabled-ink` token (currently a per-component convention,
not a token).

---

### D6 · Icon set
**Status:** PROPOSED · **Source:** Phase 3 §8.2 · **Blocks:** M4, M5

The app currently uses typographic glyphs (`◆`, `▲`, `₹`) as icons. These vary
by platform font, break optical alignment, and cannot hold a consistent stroke
weight.

**Recommendation:** commission a drawn set on the Phase 3 grid — 24×24, 1.75px
stroke, round caps and joins, 2px corner radius, outline only. The three universe
icons must read as one family differing in a single dimension.

**Commission at M0 so it runs parallel with M1–M3.** A placeholder set of correct
geometry unblocks development; a release gate prevents v1.0 shipping placeholders.

---

### D7 · Snapshot comparison policy
**Status: ACCEPTED — 3 Aug 2026 (owner).** The stricter option.
**Source:** Phase 4 §3.4 · **Blocks:** M3

Yahoo rewrites `adjClose` retroactively on every split and dividend, so a
backtest run today and the same backtest run after a corporate action will
legitimately disagree about a past month — silently.

**Recommendation:** the stricter option. Frozen month-end snapshots are compared
on every recompute, and a mismatch is **surfaced as a data-quality note naming
the month and the likely cause** — never silently overwritten, never silently
accepted.

**Consequence to accept knowingly:** this will occasionally show notes about
months you thought were settled. That is the point.

---

### D8 · TypeScript adoption
**Status:** PROPOSED (engineering decision) · **Source:** Phase 5 §6.1 · **Blocks:** M1

**Recommendation:** incremental adoption, starting at contract boundaries. A
big-bang conversion of a working, tested financial engine is a large regression
risk for zero user benefit — but six data types cross five layer boundaries, and
the bug class TypeScript prevents (a `null` where a number was assumed, a `close`
where an `adjClose` was assumed) is exactly the class this product cannot afford.

| Stage | Milestone | Converts |
|---|---|---|
| 1 | M1 | `checkJs` on; shared types for the six data-model types; strict for new files |
| 2 | M2 | Data layer and provider contracts |
| 3 | M3 | Engine **signatures**; implementations stay as they are |
| 4 | M4–M10 | Every new file is TypeScript, no exceptions |
| 5 | Post-1.0 | Remaining legacy files, opportunistically, never as a dedicated milestone |

`any` is prohibited. Nullable financial values are explicitly `number | null`.
Type assertions at a data boundary require runtime validation alongside them.

---

### D9 · Contextual help is a permanent product requirement
**Status: ACCEPTED — 3 Aug 2026 (owner-directed).** Applies to every milestone
from M4 onward, and retroactively wherever existing labels remain.

**THE REQUIREMENT**

Gati must stay understandable to someone returning after months or years.
Wherever a financial metric, technical term, calculation or feature may not be
immediately obvious — CAGR, Relative Strength, Alpha, Sharpe, Drawdown, Win
Rate, Benchmark, Execution Efficiency, Cash Drag and the rest — a small,
unobtrusive information icon sits beside the label. Tapping it shows a concise,
plain-language explanation of **what it means, why it matters, and how to read
it in Gati specifically**.

Explanations are simple, practical and non-technical. They educate without
cluttering: the icon is quiet, and the explanation appears only on demand.

**WHY THIS IS A PRINCIPLE AND NOT A FEATURE**

Gati's stated philosophy is "clarity over complexity" and "every number must be
checkable". A number the reader cannot interpret is not checkable, however
precisely it was computed — so an unexplained Sortino ratio is a failure of the
same kind as a wrong one, just quieter. It also directly serves the beginner-
first density baseline (D4): the depth a quant wants is present, one tap away,
without raising the default density for everyone else.

**HOW IT IS ENFORCED**

Documentation alone would decay the first time someone adds a metric in a
hurry. So:

- Explanations live as DATA in `config/glossary.js`, not as strings scattered
  through components — one place to read, review and improve.
- A test asserts that every glossary entry is complete and well-formed, and
  that every term the UI is known to render has an entry. A label with no
  entry fails the build.
- Design Rule 53 makes it a review criterion for every new metric.

**CONSTRAINTS**

- The icon never becomes a second tap target inside a row that is already one.
- The explanation is at most a few sentences. If a term needs more, it belongs
  in Methodology with a link, not in a tooltip.
- No jargon inside the explanation of jargon. An entry that requires a second
  entry to understand has failed.
- Never blocks or delays the number it explains.

---

### D10 · No fabricated data, and a permanent audit trail for restatements
**Status: ACCEPTED — 3 Aug 2026 (owner-directed).** Permanent engineering
principle. Supersedes and strengthens S3.

**THE PRINCIPLE**

Financial data is never fabricated, estimated, or silently substituted. If a
required historical value, previous month-end close, benchmark value, live
quote, or corporate-action adjustment cannot be verified with confidence, the
application states plainly that the value is **unavailable** or **awaiting
verification**. It does not display a value that might be wrong.

This covers, without exception:
- no interpolation across gaps, and no carrying a value forward
- no zero-filling a missing price (a zero price is a real price, and a
  catastrophic one)
- no substituting a live quote into adjusted-return maths
- no auto-adopting a guessed replacement for a renamed or delisted ticker
- no falling back to synthetic or sample data on a provider failure
- no mixing adjusted and unadjusted prices in one ratio

**THE AUDIT TRAIL**

When a historical value changes because of adjusted data, a split, a bonus, a
dividend or any other corporate action, that change is **recorded as a revision
in the snapshot history**. The record keeps what was previously shown, what it
became, when the change was observed, and which symbols moved.

**Why detection alone was not enough.** D7 already surfaced a note when a past
month changed. But the note was transient: it appeared once, the new value was
written over the old, and the previous figure was gone. A user who noted a
number in June and sees a different one in August could be told *that* it
changed but not *what it was*. An audit trail that cannot reconstruct the prior
state is a notification, not an audit. Revisions are therefore appended and
retained rather than overwritten.

**WHY THIS IS THE HIGHEST-PRIORITY RULE IN THE CODEBASE**

Every other quality in this product is recoverable. A slow screen can be made
fast, an ugly one redesigned, a confusing one explained. A number that is
quietly wrong is not recoverable, because the user acts on it before anyone
notices — and an outage is visible where a plausible wrong figure is not. So an
honest gap always beats a plausible number, and the bar for showing a value is
that it can be verified, not that it is probably fine.

**ENFORCED BY**
- The same-basis guard, which refuses to produce a ratio rather than flagging one
- Per-symbol tolerance with typed, scoped failures
- The rename map, which suggests and never adopts
- The bar store, which counts write failures instead of swallowing them
- Snapshot comparison plus the revision log
- Engineering rules 21-30 in `CONTRIBUTING.md`

---

### D11 · Two-tier contextual help, and eight standing principles
**Status: ACCEPTED — 3 Aug 2026 (owner-directed).** Extends D9; applies to
every milestone from here.

**1 · CONTEXTUAL HELP IS A CORE FEATURE, IN TWO TIERS**

Every explanation answers three questions — *what is it*, *why does it matter*,
and *how do I use it inside Gati's Relative Strength methodology*.

The **default tier is extremely short**: one plain sentence each, beginner-
first, readable in a glance. A **Learn more** tier expands on demand with a
deeper explanation, a worked example, limitations, and — only where the formula
IS the meaning — the formula itself.

*Why two tiers rather than one good paragraph.* A single explanation has to
choose between the beginner it would overwhelm and the quant it would bore, and
it always ends up failing one of them. Splitting means the default can be
genuinely short without losing the depth, and the reader chooses. **The default
must never overwhelm.**

**2 · EVERY EXPLANATION RELATES BACK TO GATI**

No generic textbook definitions. An explanation says how the metric affects a
decision *inside this methodology* — what it means for the Top 5, the monthly
rebalance, the benchmark comparison, the Investment Simulator. The goal is
better decisions, not defined terms. Enforced by test: the third field must
reference something specific to Gati.

**3 · BEGINNER-FIRST, ALWAYS**

Simple at first glance; depth disclosed only when asked for. A beginner should
never feel intimidated, and an experienced investor should never be stuck at a
shallow ceiling. Solved by layering, never by averaging.

**4 · ACCURACY OVER DISPLAYING A NUMBER**

Never fabricated, estimated, silently substituted, or **rounded into a
misleading value**. Where anything cannot be verified with confidence, say it
is unavailable or awaiting verification. (Extends D10 with the rounding clause:
a figure rounded until it implies a precision the data does not support is a
quieter version of the same failure.)

**5 · PERFORMANCE FIRST**

Fast startup, responsive interaction, minimal API calls, efficient caching,
lazy and progressive loading, virtualisation where it earns its place, instant
feedback. It must feel light on slow hardware and slow networks.

**6 · STRATEGY EVALUATION STAYS SEPARATE FROM EXECUTION SIMULATION**

Historical performance remains capital-independent. Whole-share execution, idle
cash, execution efficiency and cash drag exist **only** in the Investment
Simulator. (Restates D1 as a standing rule.)

**7 · EVERY METRIC IS UNDERSTANDABLE WITHIN ONE TAP**

Anything that could reasonably confuse a reader carries contextual help.

**8 · THE QUESTION ASKED OF EVERY VISUAL ELEMENT**

> *Does this help the investor identify, understand, or confidently act on
> Relative Strength Momentum?*

If no: simplify it, or remove it.

---

### D4 · Beginner-first density baseline
**Status: ACCEPTED — 3 Aug 2026.** Confirmed by standing instruction: the owner
has directed "continue following the Beginner-First philosophy with progressive
disclosure" in three consecutive briefs, which settles the question the original
proposal raised.

Default disclosure depth is set for the beginner. The active investor is served
by one extra tap; the quant by layering. **Density is never raised for everyone
to serve the few.** Every section beyond the primary content is collapsed by
default, and the contextual-help system (D9/D11) carries the depth.

---

### D12 · The four questions, and cross-universe continuity
**Status: ACCEPTED — 3 Aug 2026 (owner-directed).** Applies to every universe
screen, permanently.

**THE FOUR QUESTIONS**

A universe screen must answer all four within the first few seconds:

1. **What are the current Top 5?** — the Top 5 card, above the fold, always.
2. **What changed since the previous rebalance?** — entries, exits and rank
   moves, from the change-detection engine.
3. **Why are these stocks ranked here?** — the RS Ledger showing both operands,
   plus the three-month RS trend.
4. **What action should the investor take?** — see the framing note below.

**HOW QUESTION 4 IS ANSWERED, AND WHY IT IS FRAMED THIS WAY**

Gati states **what the strategy did**, never what the user should do. Each pick
carries a factual status — *new this month*, *held since March*, *dropped out* —
derived mechanically from comparing the last two completed rankings.

That is a description of the model's own behaviour, and it is checkable. "Buy
this" would be advice: unverifiable, unaccountable, and outside what a
Relative Strength ranking can support. The distinction matters more here than
almost anywhere else in the product, because a confident-sounding
recommendation is exactly the thing a user would act on without checking.

The investor still gets their answer — they can see that two names are new, so
those are the buys; two exited, so those are the sells; one is held, so it
stays. The app supplies the facts and the arithmetic; the decision stays theirs.

**CROSS-UNIVERSE CONTINUITY**

The measurement window, ranking filter and sort carry across universe switches.
Comparing large, mid and small caps at the same window is the whole point of
having three; resetting to a default on every switch would silently change what
is being compared, and the user would not be told.

**REBALANCE TIMING**

The last rebalance date and the next scheduled review are shown as quiet
context beside the verdict — never as a countdown, never as urgency. A monthly
strategy has nothing to do between rebalances, and an interface that implies
otherwise is manufacturing activity it cannot justify.

---

### D13 · Momentum continuity — rebalance summary and Momentum Age
**Status: ACCEPTED — 3 Aug 2026 (owner-directed).** A decision-making
refinement, explicitly not a feature addition.

**THE REBALANCE SUMMARY**

Each universe shows a compact account of the latest rebalance: how many stocks
entered, how many continued, and how many left. Three numbers, one line.

**MOMENTUM AGE**

Each pick shows how many consecutive monthly rebalances it has held its place
in the Top 5.

*Why this earns its place.* A ranking is a snapshot, and a snapshot cannot
distinguish a stock that just broke out from one that has led for six months.
Those are different propositions: newly emerging momentum is less established
and more likely to be noise, while a long run is more established and — on the
same evidence — closer to whatever mean reversion eventually arrives. The
number does not say which is better. It says which situation the investor is
looking at, which is the thing a rank alone hides.

**IT COMES FROM WORK ALREADY DONE**

Both are PROJECTIONS of `backtest.rankingHistory`, which already ranks the
entire universe at every completed month-end. Momentum Age is one reverse pass
over that output; the summary is arithmetic on the existing entry/exit diff.
No prices are re-read, no ranking is recomputed, and no second source of truth
is created — which is the constraint the instruction set, and the right one:
a duplicated calculation is how two screens end up disagreeing.

**FRAMING, per D12**

Momentum Age is a fact about the strategy's own history, not a signal. It is
never rendered as a recommendation, a score, or a reason to act.

---

### D14 · Historical context, momentum direction, and methodology versioning
**Status: ACCEPTED — 3 Aug 2026 (owner-directed).** Applies from M8 onward.

**1 · SIMPLE HISTORICAL CONTEXT**

A reader should be able to see how a stock's ranking has evolved across recent
rebalances, and the Strategy Record should explain how the portfolio changed
over time rather than only what it returned. Derived from the existing ranking
history; no new calculation, no new source of truth.

**2 · MOMENTUM AGE** — as established in D13, from the same engine projection.

**3 · MOMENTUM DIRECTION — Improving · Stable · Weakening**

Derived only from the existing trailing RS history. **Descriptive, never
predictive.** The wording is deliberate:

- *Improving* says relative strength has risen across the observed months. It
  does not say it will continue.
- *Stable* is the honest reading of a small move on three data points, where
  the change is not distinguishable from noise. Calling that a trend would
  dress up noise as a signal.
- *Weakening* says strength has fallen. It is not a sell instruction.

The label describes what already happened. Gati has no view on what happens
next and must never imply one — a directional word next to a price is read as
advice unless the surrounding language refuses it.

**4 · REPORTS EXPLAIN WHY, NOT ONLY WHAT**

Every report and the methodology screen state the reasoning under Gati's
Relative Strength methodology, using the approved contextual-help system rather
than longer prose. A number without its reasoning is a fact the reader cannot
check.

**5 · METHODOLOGY VERSIONING**

Every report carries the methodology version used to produce it. If the
calculation ever changes, results computed under different versions remain
identifiable and comparable rather than silently blended. This is the same
instinct as the D10 revision trail: a figure that changed must be explainable,
not merely different.

**6 · THE CORE PHILOSOPHY, RESTATED AS STANDING LAW**

Relative Strength Momentum only · transparency over complexity · performance
before visual effects · financial data is never fabricated · strategy
evaluation stays capital-independent · execution simulation stays
capital-dependent · every screen helps the investor make one decision faster.

---

### D15 · UI/UX refinement brief — six conflicts
**Status: RESOLVED — 4 Aug 2026 (owner).** All six recommendations accepted:
the approved architecture stands unchanged. No 8-item sidebar, no Command
Center, no capital in the record, no opinion system, no composite score, no
countdown.

**Standing rule added by the owner:** where a future inspiration document
conflicts with approved architecture, the architecture wins unless the owner
explicitly instructs otherwise.

**Original register, kept for the record:** Part 1 of the refinement shipped in
v0.31.0. These six are NOT implemented, because each reverses a decision marked
FINAL, and the same brief says "Do NOT remove existing decisions."

| # | Brief asks for | Reverses | My recommendation |
|---|---|---|---|
| C1 | Permanent left sidebar, 8 destinations | Phase 1 dec. 1–3, Phase 2 Part 5 (nav caps at 5), M5 deleted the sidebar | **Keep 5.** Add a desktop rail *label* expansion instead — professional feel without an 8-item nav on a 390px phone. |
| C2 | "Command Center" dashboard | Phase 1 decision 1: "There will NOT be a separate Dashboard page" (FINAL) | **Keep universe-first.** The Dashboard was deleted because it was a tap that earned nothing. If a cross-universe overview is wanted, Reports already is one. |
| C3 | "Portfolio Value" above the fold | Phase 1 decision 4 + D1: the record is capital-independent and assumes no amount | **Do not.** This is the exact figure D1 removed. The Investment Simulator already shows a value once the user enters an amount. |
| C4 | "Divu's Opinion" — market read, posture, confidence | Phase 1 §42 forbids "AI market opinions"; D12 forbids advice framing | **Do not build.** Gati's credibility rests on stating what the strategy did. An opinion section is unverifiable by construction and is the one thing that would make every other number look like a pitch. |
| C5 | Portfolio Health Score 0–100 | Phase 1 §8 explicitly REJECTED a composite confidence score | **Do not.** An opaque composite carries more authority than the transparent metric beneath it, and cannot be checked — which breaks the product's central promise. |
| C6 | Rebalance countdown | D12: rebalance timing is "quiet context, never a countdown" | **Keep as context.** A monthly strategy has nothing to do between rebalances; urgency manufactures activity the method cannot justify. |

**Also noted, smaller:** India VIX in the market strip is a fourth data source
and a scope addition (Phase 1 §42), not a refinement.

**What DID ship in part 1:** the shared surface vocabulary, sparklines, sector
badges, sticky action bar, density and hierarchy work — everything in the brief
that conflicts with nothing.

**What part 2 would cover once these are settled:** global search, chart
presentation polish, micro-interactions, the strategy-card library, mobile
review, and the accessibility sweep.

---

### D2 · Long-term chart range behaviour
**Status: ACCEPTED — 4 Aug 2026 (owner).** Supersedes the earlier proposal A3,
which suggested disabling unreachable ranges.

**THE RULE**

The application must never fabricate, extrapolate, compress, or visually
stretch historical data to satisfy a requested time range.

- **3Y and 5Y remain selectable.** They are not disabled.
- **Where insufficient history exists, the chart shows all available verified
  history only** — never padded, never rescaled to fill the axis.
- **The gap is stated plainly**: what was asked for, what exists, and from when
  the missing data would be needed.

**WHY SELECTABLE RATHER THAN DISABLED**

The earlier proposal greyed them out. Disabling is defensible but says the
wrong thing: it implies the range is unavailable, when in fact the range is
perfectly valid and the DATA is what falls short. Selecting 5Y and being told
"showing all 19 months available — 5Y would need data from Aug 2021" is a more
honest answer than a control that refuses to respond.

**THE CONSEQUENCE TO HANDLE CAREFULLY**

With data from 2025-01-01, the 3Y, 5Y and All ranges currently render an
identical chart. A reader who selects 5Y, sees no change, and is told nothing
will reasonably conclude the control is broken. So the coverage notice is not
optional decoration — it is the only thing distinguishing "this range is the
same as All" from "this button does nothing".

**RELATIONSHIP TO D10**

This is the same principle as the no-fabrication rule, applied to an axis. A
chart stretched to fill a range it does not have data for is a fabricated
picture, and a picture is harder to check than a number.

---

### D16 · The compute layer is a retained extension point
**Status: ACCEPTED — 7 Aug 2026 (owner). Do not relitigate.**

`compute/deriveUniverse.js` and `compute/computeScheduler.js` are complete,
tested, and **deliberately not wired**. They are retained as the Web Worker
escape hatch for the heavy pass.

**They must not be deleted as dead code.** A scan will report them as
unreferenced, because they are. That is intentional, not an oversight.

**They must not be wired without a measured bottleneck.** The heavy pass sits
at ~150ms against a 250ms budget; `useUniverseData` already memoises the same
work. Refactoring the data path without a measurement would trade a working
system for an unmeasured one.

**The trigger for revisiting:** the heavy pass breaching its budget on real
hardware. At that point the escalation is a flag flip rather than a refactor,
which is the entire reason this seam was built in M3 and left alone since.

### D17 · The launch splash is a deliberate exception to the motion rule
**Status: ACCEPTED — 8 Aug 2026 (owner, specified in full). v1.3.0.**

`src/index.css` states that two animations exist in the entire application,
because "a financial interface that performs undermines the trust its numbers
are earning." The launch splash is a **third**, added at the owner's explicit
instruction, and it is recorded here rather than left as a silent
contradiction of a principle the codebase states out loud.

**Why the exception holds.** The splash plays before any number is on screen.
It cannot decorate data, and it cannot delay the reading of a figure that is
not yet rendered. The principle above still governs every screen.

**The line it must not cross.** The splash NEVER waits for data. It is a
fixed-length brand moment layered over an app that boots normally underneath
it — mounted as a sibling of the router, not a wrapper around it. Made into a
loading gate, a slow network would turn a 2-second animation into an
indefinite one, and the app already has skeletons for that job.

**What is fixed:**
- Concept #2 "Luxury Light Sweep" from the owner's storyboard, treated as the
  specification and not as inspiration
- The artwork is never altered — shape, colour, geometry, proportion. Only
  its illumination is animated
- Compositor properties only: every keyframe animates `opacity` or
  `transform`, nothing else. A test enforces this, because the obvious
  implementation (`mask-position`) repaints every frame and would pass review
- Reduced motion gets a **complete alternative**, not a truncated one: the
  mark simply appears, holds and fades. Nothing is lost, because the splash
  never carried information
- The splash background is duplicated in three places that cannot import each
  other — `config/splash.js`, the pre-paint `<style>` in `index.html`, and
  `background_color` in the manifest, which is what Android paints before this
  app runs at all. A test asserts all three. **Do not "clean up" this
  duplication** (same reasoning as S9)

**Two additions the owner did not ask for, and may remove:**
tap-to-skip (which fades, never cuts), and the ~2s total. Both are one
constant or one handler.

**The trigger for revisiting:** the owner finding the launch too long in daily
use. The duration is a single object in `config/splash.js`; nothing else needs
to change.

---

### D21 · M15 — six additions, all of them risk VISIBILITY
**Status: ACCEPTED — 15 Aug 2026 (owner).**

The owner asked what he was missing as someone about to put real money in.
Six items were proposed and all six accepted. They share one purpose, and
naming it is what keeps them inside Phase 1 §42's scope control rather than
being feature creep:

**None of them changes what the strategy does. Every one makes a risk that
already exists visible instead of leaving it to be remembered.**

That is the principle already governing the data layer — flag the problem,
never quietly calculate around it — applied to the things that cost a real
investor money: tax, concentration, time spent underwater, liquidity, and the
gap between what the rule says and what is actually held.

**THE HARD BOUNDARY.** Ranking, Relative Strength, rebalance selection,
benchmark mapping and the execution convention are NOT touched. Tax and costs
are POST-PROCESSING on a completed record. If a change to any of those files
becomes necessary, that is a signal the design is wrong, not permission.

### D22 · Tax is modelled, and modelled properly
**Status: ACCEPTED — 15 Aug 2026 (owner).**

A monthly rebalance means almost nothing is held twelve months, so nearly
every gain is short-term. On Indian equities that is a heavier drag than
brokerage, STT and slippage combined — and it was the one cost the app did not
show. It can flip a conclusion: a strategy ahead by 3% gross can be behind its
benchmark after tax.

**The rate is verified, not assumed.** Section 111A: 20% on transfers on or
after 23 July 2024 (raised from 15% by the Finance (No. 2) Act, 2024), plus 4%
health and education cess — 20.8% effective for a taxpayer with no surcharge.
Surcharge on 111A gains is capped at 15% where it applies.

Roughly half the sources checked still print 15%. They are stale. The rate is
therefore a CONFIGURABLE CONSTANT carrying its own dated provenance, not a
literal buried in a calculation, because it has changed once inside two years
and will change again.

**Losses are set off, because not doing so would overstate the tax.** Short-
term capital losses offset short-term gains. A model taxing every winner while
ignoring every loser would report a drag the investor would never actually pay
— a different dishonesty from ignoring tax, but dishonesty. Netting is per
Indian financial year (1 April – 31 March).

**Scale-invariance is what makes this publishable.** Under fractional
weighting the equity curve is a base-100 index invariant to account size, and
tax is a percentage OF GAINS, so it applies identically at any capital. No
account size is assumed and D1 is untouched.

**It errs high, deliberately.** A fiscal year ending in a net loss owes
nothing, and that loss is NOT carried into the next year even though the law
allows eight years of carry-forward. Modelling carry-forward would make the
figure depend on the reader's filing behaviour, which the app cannot know, and
erring toward "worse than reality" is the safer error for a number someone
might act on. `carriesLossesForward: false` is returned so the UI can say so.

**It is an estimate and says so.** It excludes surcharge, the LTCG exemption,
prior-year losses and every personal circumstance, and Gati never calls it tax
advice.

### D23 · The rebalance action list — subtraction, not advice
**Status: ACCEPTED — 15 Aug 2026 (owner).**

The owner asked "when do I buy, and what?" and had to be told in
conversation. The app held both halves — his real positions, and the current
Top 5 — and joined them nowhere.

It states the difference: held and still ranked, held and no longer ranked,
ranked and not held. No quantities, no order values, no "act now". The
Investment Simulator sizes positions; this compares two lists. The moment it
produces amounts it stops being an observation and becomes a recommendation.

**It is NOT the rebalance countdown rejected under D15/C6.** No clock, no
deadline. It must state whether the month is complete, because a mid-month
Top 5 is provisional and acting on it is precisely the behaviour the monthly
rule exists to prevent — and the list looks identical on the 3rd and the 30th.

**Scoped to one universe.** Each has its own Top 5 and its own benchmark. A
small-cap holding is not "missing" from the NIFTY 50 Top 5; comparing across
them would manufacture actions out of a category error.

### D24 · Concentration, underwater duration, liquidity
**Status: ACCEPTED — 15 Aug 2026 (owner).**

- **Sector concentration.** Five stocks is concentrated by construction; the
  question is whether it is also concentrated by accident. Momentum does not
  diversify — when one part of the market runs, the ranking fills with it, and
  three of five in one sector is a sector bet wearing a momentum label. Sector
  was already shown per stock; only the sum was missing.
- **Underwater duration.** Max drawdown gives the depth. Duration — how long
  the record stayed below its previous peak — is what makes people abandon a
  strategy. Depth is quoted; duration is endured.
- **Liquidity.** The simulator sizes whole shares without asking whether a
  smallcap trades enough to absorb the order. Immaterial at ₹50,000, real at
  ₹5,00,000. Expressed against average daily volume.

None is a composite score. D15/C5 stands: plain figures that keep their
meaning, never a blend that hides its inputs.

### D25 · The paper-trade log is a decision journal, not a second backtest
**Status: ACCEPTED — 15 Aug 2026 (owner).**

The record already shows how each month's Top 5 performed. A paper log that
recomputed that would be a duplicate engine and a second place for the numbers
to disagree.

Its value is a commitment recorded BEFORE the outcome is known — the one thing
a backtest cannot supply, and what tells the owner whether he can sit through
a bad stretch. It stores an intention and the stocks he would actually buy
(owner's choice: the interesting months are the ones where he DISAGREES with
the Top 5, and a tick-box could never record a deviation), timestamped, shown
later beside what happened.

Stored separately from the real portfolio. The two must never mix.

---

### D27 · A stock with no data this month cannot be ranked
**Status: ACCEPTED — 27 Aug 2026. Bug fix, not a strategy change.**

The prior month-end was taken as the stock's own last bar before the current
month. That is correct while a stock trades — it resolves holidays with no
calendar involved — and silently wrong once a stock stops. A series ending 27
July, read on 27 August, reported 27 July as the "previous month close",
divided that bar by itself for a **0.00%** month-to-date, and was ranked on
the result.

**The rule: a stock with no bar in the benchmark's current month has no
current-month return. Not zero — absent.** Flagged `STALE_PRICE`, left
unranked, with the last session it holds data for named in the reason.

**Deliberately not a tolerance in days.** "Has it traded this month" is a
verifiable fact. "Is five sessions too many" is a judgement, and a stock
halted for a week mid-month still has a real price to measure from. Thin
trading is a liquidity question and is answered elsewhere.

This is an EXCLUSION rule. No formula changed. The distinction matters
because ranking logic is otherwise frozen (§35): a stock that could not
honestly be ranked simply is not, and everything else computes as before.

---

### D28 · Every column at every width; nothing pinned
**Status: ACCEPTED — 27 Aug 2026 (owner). Reverses the v1.4.0 responsive rule.**

Columns carried a `minWidth` below which they were dropped, on the stated
basis that all eleven remained "reachable by scrolling". **That was false** —
a dropped column is not in the DOM. On an upright phone five of the eleven
did not exist, and rotating the device was the only way to reach them.

All eleven now render at every viewport, at their desktop widths, with the
scroller carrying the overflow. Rank and Ticker are no longer sticky at the
owner's instruction: on a 390px phone they consumed 144px to anchor a row the
reader identifies by its position in a sorted list anyway.

Header rows keep their VERTICAL stickiness. That solves a different problem —
250 rows whose column names scroll away — and was never in question.

---

### D29 · The Dashboard curve is indexed, like every other curve
**Status: ACCEPTED — 27 Aug 2026.**

The reference build prints "₹62K" on this chart. D1 removed exactly that
assumption, and it does not return because the chart moved screens: a rupee
figure on an equity curve describes an account nobody opened.

Both legs are built by ONE `buildIndexedBenchmarkCurve` in
`utils/chartData.js`, shared with the Strategy Record. Two copies of a
compounding loop would be two chances for the two screens to disagree about
what the benchmark did — a divergence that surfaces as one screen quietly
contradicting another rather than as a failing test. A wiring test asserts
exactly one definition exists.

---

### D31 · The current month is read from the latest bar, and stays that way
**Status: ACCEPTED — 28 Aug 2026 (owner). Reviewed and deliberately kept.**

`computeCurrentMomentum` determines the current in-progress month from the
LATEST AVAILABLE BAR, not from the wall clock. The consequence is a short
window on the 1st of a month — before that day's first bar exists — where the
month just ended still reads as in progress, and the prior month-end is
therefore the one before it.

Raised with the owner as a possible defect during M16. **Reviewed and kept.**
The reasoning: reading the calendar instead would let the ranking measure
against a month-end the data has not reached, which is look-ahead bias, and
the app refuses to compute against prices that do not yet exist. A narrow
labelling artefact on one day is the cheaper of the two errors.

**Do not change this unless a clear calculation error is demonstrated.** It is
core ranking methodology, not presentation.

---

### D34 · A quality gate must prove it ran on real content
**Status: ACCEPTED — 29 Aug 2026. Found in the final pre-release audit.**

`qa:browser` checked whatever was sitting in `dist/`. `npm run build` targets
the Yahoo provider, so anywhere without live market access every data screen
rendered its error state — and "no axe violations, no overflow" is trivially
true of a blank page. Measured: four primary routes at 0 rows, 0 info icons
and 0 charts, against 50 rows, 42 icons and 5 charts on a populated build.
The gate reported PASS both times.

**The rule: a gate that inspects rendered output must build its own input and
assert that the output is non-empty. A check which cannot distinguish "nothing
is wrong" from "nothing is there" is not a check.**

Three parts, all required:
1. the gate builds with the mock provider itself, so a run never depends on
   which build happened to precede it;
2. every data route declares the content it must contain, and a shortfall
   fails loudly with the actual counts;
3. it WAITS for that content instead of guessing a settle time — the fixed
   2200ms was under the 4.5s the small-cap dashboard needs, so that route was
   always measured on its loading skeleton.

This is the same family as the unwired-module problem and the untracked QA
server: the failure is never a red gate, it is a green one that means nothing.

---

### D33 · A price series is normalised once, at the boundary
**Status: ACCEPTED — 29 Aug 2026. Bug fix, found in the cross-check audit.**

Every engine in this app reads a series by POSITION: `series[series.length-1]`
is "the latest bar", `merged[0]` is the coverage start. That is fast and it is
correct **only if the series is sorted ascending with one bar per date** — an
assumption nothing enforced. `barStore` sorted on merge but not on first
write, and the cache-miss path handed the provider's raw array straight to the
engine, so the same response could rank differently depending on whether the
cache was warm.

**The rule: a price series is sorted ascending and de-duplicated ONCE, where
it enters the app, by one shared `normaliseBars`. No engine sorts, and no
engine assumes an unsorted series is possible.**

Conflicting duplicates — the same date with two different closes — are NOT
resolved. Which price is real is not a question a cache or a data layer can
answer, and choosing one would be a guess presented as a fact. The symbol is
failed onto the existing exclusion channel and named in "Could not be ranked".

Normalisation lives at the boundary rather than in the engine deliberately: an
engine that defensively sorts its input is an engine that cannot tell a clean
series from a dirty one, and the fault would move rather than be fixed.

---

### D32 · Both legs of any comparison span the same dates
**Status: ACCEPTED — 28 Aug 2026 (owner). Bug fix.**

The stock detail card showed a 1-month stock return against a benchmark return
and an Outperformance total that both followed the SELECTED window. At 1M all
three agreed; at 6M and 12M the two visible rows implied the stock had trailed
while the total said it had won — a contradiction in sign, on a card whose
layout invites checking the subtraction.

**The rule: wherever a stock return and a benchmark return appear together,
both are measured from the same reference session to the same latest bar, over
the selected window.** Never one leg from one span and one from another.

`computeStockRS` already guarantees this for the pair it returns. The defect
was a view substituting one leg from a different field, so the rule is really
about wiring: read the PAIR an engine produces, never half of it plus
something that looks similar.

Two supports were added rather than trusting the rule to hold itself:
- Fields are named for what they contain — `stockWindowReturnPct`, not
  `stockSinceMonthEndPct`. The old name is how a six-month figure passed for a
  monthly one.
- The card NAMES its span and its start date, so a reader can see the
  comparison change when the window changes.

Month-to-date remains a separate, window-independent figure with its own
anchor date. It was never wrong; conflating it with the comparison was.

---

### D30 · `InfoTip` may carry current state, and only current state
**Status: ACCEPTED — 27 Aug 2026.**

The glossary is static by design: written once, reviewed against D11,
identical everywhere a term appears. It cannot answer the question a reader
actually has when they tap the icon beside a price — "is this live, or
Friday's" — because the answer changes by the minute.

`InfoTip` takes an optional `note`: one sentence of current state, rendered
under the definition and visually distinct from it.

**The rule that keeps this from becoming a second, unreviewed glossary: a
note states a fact about THIS MOMENT — a session, a date, a status. Anything
that would read the same tomorrow belongs in `glossary.js`.**

---

### D26 · Where each addition lives
**Status: ACCEPTED — 15 Aug 2026 (owner).**

| Addition | Home | Why there |
|---|---|---|
| Tax toggle | Settings, beside the cost toggle | One place where all assumptions are set |
| Net-of-tax figures | Strategy Record | Where performance is judged |
| Action list | My Portfolio ONLY | Owner's choice. The Command Center is about the strategy; real holdings are deliberately kept off it (D1) |
| Sector concentration | Top 5 card + Simulator + My Portfolio | Wherever a set of five is shown |
| Underwater duration | Strategy Record, Risk | Beside max drawdown, its other half |
| Liquidity | Investment Simulator | Where order size is decided |
| Paper log | Its own screen, under SYSTEM | Consulted, not worked in |

**Tax defaults OFF, with the honest number always visible anyway.** Costs
already default off; turning tax on alone would give an incoherent figure —
tax deducted, brokerage ignored — and would silently change every number the
owner has been reading. A persistent net-of-everything line sits under the
headline whatever the toggles say, so nothing is hidden and nothing shifts
underfoot.

---

### D18 · The Terminal shell — D15/C1 and D15/C2 are reversed by the owner
**Status: ACCEPTED — 11 Aug 2026 (owner, explicit). Supersedes D15/C1 and
D15/C2 only.**

D15 resolved on 4 Aug 2026 that the approved architecture beats an inspiration
document *"unless the owner explicitly instructs otherwise."* On 11 Aug 2026
the owner explicitly instructed otherwise, having been shown the hybrid
alternative and declined it. This is that instruction, recorded so the reversal
is legible rather than a silent drift.

**Adopted, from `gaati.netlify.app` v1.0.0 (JUL 2026):**
- A permanent 236px left sidebar with a WORKSPACE / SYSTEM section split
- A **Command Center** home, which D15/C2 had refused

  **Measured correction, worth recording:** D15/C2 refused Command Center as
  "a separate Dashboard page… a tap that earned nothing." That was true of the
  *name*, not of the thing. The source app's Command Center is **per-universe**
  — its metric strip, equity curve, Top 5 and monthly chart all change with the
  universe tab strip. Verified by driving the tabs in a real browser: the Small
  Cap Command Center and the Small Cap Live Rankings return the same five
  names. It is therefore not a cross-universe dashboard at all. It is Gati's
  existing universe screen under a different name and a different layout, with
  the universe promoted from a nav destination to a global tab strip.

  This makes the reskin far safer than it first appeared: `/:universeKey`
  stays exactly where it is and keeps answering D12's four questions. No new
  aggregate page, no new figure, no cross-universe roll-up that would need a
  calculation nobody has reviewed.
- Topbar with breadcrumb, market status, search, and a ticker tape beneath it
- The full visual language: palette, Manrope + DM Mono, panel and card
  treatment, table density, chart styling
- **Per-universe accent** — NIFTY 50 `#d7ff43`, Midcap `#7dd3fc`, Smallcap
  `#f0abfc`. The single best idea in the source design: it maps exactly onto
  the three universes and makes "which universe am I in" pre-attentive.

**NOT adopted, and still governed by their original decisions:**
- D15/C3 — no portfolio value in the strategy record. The Command Center's
  first metric tile is Total return, not "Portfolio value ₹66T". D1 stands.
- D15/C4 — no opinion system. See D20.
- D15/C5 — no composite confidence score. The source app's "Confidence 78%"
  is not ported.
- D15/C6 — no rebalance countdown. Timing stays quiet context.
- India VIX. A fourth data source and a scope addition. The ticker tape keeps
  the four verified symbols Gati already fetches.
- "Strategy alpha" as a label. It is a difference of two percentages and
  renders as **Outperformance**. The standing ban is unaffected.
- The `DM` profile avatar and the notification bell. There are no accounts in
  Gati (D3) and nothing sits behind either control.

**The source app is not an ancestor of this codebase.** It is a separate
prototype — TanStack Start, Chart.js, and hardcoded demonstration data with no
fetch layer at all. Nothing is being restored; this is a reskin of Gati onto a
borrowed visual language.

**What must not change:** no engine, selector, ranking, benchmark, rebalance or
data-layer code is touched by this work. If a test breaks during the reskin,
the reskin is wrong. Tests are retargeted only where a guard's subject genuinely
moves — never deleted.

### D19 · Dark is the default; the light theme survives
**Status: ACCEPTED — 11 Aug 2026 (owner).**

The source design is dark-only. Gati defaults to light with a dark toggle. The
owner chose **dark default, light retained**.

Consequence, recorded because it is real work rather than a setting: a light
variant of the terminal palette has to be *derived*, not sampled. `#d7ff43` on
a light ground is about 1.3:1 and is unreadable as text. Each accent therefore
carries two tones in light mode — a darkened text-safe tone and the original
bright tone for fills and chart strokes, which carry no text. This is the same
`gold` / `gold-fill` split the palette already uses, extended to three accents.

The contrast gate runs over both themes and is not relaxed for this work.
Several source tokens fail WCAG AA outright (`#4f5c64` section labels on
`#0c1114` ≈ 2.4:1; `#47545c` captions; the 8px `#526169` disclaimer). Hue is
preserved; luminance is lifted the minimum needed to pass.

### D20 · No opinion system, in any shell
**Status: ACCEPTED — 11 Aug 2026 (owner). Reaffirms D15/C4.**

The source app devotes a nav destination and a Command Center panel to "Divu's
Opinion" — an AI market read with a posture, a risk radar and a confidence
percentage. The owner chose to **leave it out entirely** rather than fill the
slot with a factual panel.

The layout closes around it: WORKSPACE carries six destinations, not seven, and
the Command Center's lower grid is a two-column split of real material rather
than a chart beside an opinion.

Phase 1 §42 and D15/C4 stand unchanged. Gati states what the strategy did.

## Standing decisions (carried from earlier phases — do not relitigate)

| # | Decision | Recorded |
|---|---|---|
| S1 | The app is named **Gati** (गति — motion/momentum). Supersedes every earlier naming question. | 1 Aug 2026 |
| S2 | The mark is **supplied artwork** (`brand-src/LOGO.png`), raster, never redrawn or regenerated from code. The earlier code-generated identity is retired. | v0.19.1 |
| S3 | **Never fabricate market data on failure.** Superseded and broadened by **D10**. | 31 Jul 2026 |
| S4 | **Never auto-adopt a guessed replacement for a renamed or delisted ticker.** Flag and suggest; a human confirms. | 31 Jul 2026 |
| S5 | Per-symbol tolerance: one bad stock ≠ universe failure. Benchmark failure or total failure = universe-wide error. The asymmetry is deliberate. | v0.14.5 |
| S6 | Twelve strategies registered (1/3/6/12-month × 3 universes) by explicit user choice. | 2 Aug 2026 |
| S7 | Live quotes drive display columns only and never enter return maths — they are unadjusted and would break an adjusted ratio across any corporate action. | v0.5.0 |
| S8 | Rendered chart *geometry* is deliberately untested (jsdom supplies no `ResizeObserver`; the plot surface resolves to zero size). Every chart's data transform **is** tested. Revisit only if charts gain interactive behaviour. | v0.9.0 |
| S9 | The pre-paint theme bootstrap in `index.html` duplicates four constants from `utils/theme.js` **on purpose** — an inline script cannot import a module without becoming async and reintroducing the white flash. A test asserts they never drift. Do not "clean up" this duplication. | v0.19.0 |
| S11 | The **Calculator** is renamed the **Investment Simulator**. It is where whole-share execution, idle cash, cash drag, execution efficiency and the ideal-vs-executable gap are shown. Supersedes the "Capital Calculator" naming in Phases 1–3. | 3 Aug 2026 |
| S10 | Do not deliver zip files or downloads unless explicitly asked. Keep the project on disk, iterate version on version, report progress in text. | Standing |
| S12 | The per-universe home screen is called the **Dashboard**. It was called the **Command Center** until v1.6.1, and earlier entries in this file use that name — they are records of what was decided at the time and are deliberately NOT rewritten. Read "Command Center" as "Dashboard" throughout. The thing itself is unchanged: per-universe, universe-first, and NOT the separate cross-universe overview page that Phase 1 decision 1 removed (see D15/C2). | 27 Aug 2026 |

---

## Superseded

| Decision | Superseded by | When |
|---|---|---|
| Name the app "My Dashboard" / keep current name | S1 — the app is Gati | 1 Aug 2026 |
| Code-generated brand mark | S2 — supplied artwork | v0.19.1 |
| Fall back to sample data on live-provider failure (v0.13.0 design) | S3 — honest error, no fallback | 31 Jul 2026 |
| Calculator basis "held since last month-end" | Removed — carried look-ahead bias (today's Top 5 priced at last month-end manufactures a gain nobody could capture) | v0.15.0 |
| A previous "v0.18.0" describing theming and 12 strategies | Discarded entirely — it existed only in documentation, never in code. The real v0.18.0 is an independently verified build from v0.17.1 source. | 2 Aug 2026 |
