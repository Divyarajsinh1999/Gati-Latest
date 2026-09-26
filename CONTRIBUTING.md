# Contributing to Gati

Gati is a Relative Strength momentum platform. People will move real money on
the strength of the numbers it shows. That single fact sets every standard
below — a wrong number displayed confidently is worse than an outage, because
an outage is visible.

Read `DECISIONS.md` before changing anything. It records what has already been
settled and must not be relitigated.

---

## The one command

```bash
npm run verify
```

Runs, in order: lint (including architectural layer boundaries) → typecheck →
tests → build → bundle-size gate → performance gate.

**Nothing is "done" until this passes and you have read its output.** Not "it
should pass". Not "it passed earlier". This project's history contains a
session that produced a complete changelog for work that was never written to
disk; the discipline that catches that is running the command, not trusting
the notes.

---

## Architecture, in one diagram

```
presentation  →  view state  →  orchestration  →  engines  →  data
                                                     ↑
                                        config (dependency-free leaf,
                                         importable from anywhere)
```

Dependencies flow one way. **This is enforced by lint, not by good intentions**
— see `eslint.config.js` and `tests/architecture/layerBoundaries.test.js`.

| Layer | May import | Must never import |
|---|---|---|
| `engine/` | `config/`, sibling engines | React, `data/`, `hooks/`, `components/` |
| `config/` | `config/` | anything else |
| `data/` | `config/`, providers | `engine/`, React, UI |
| `selectors/` | `engine/`, `config/` | React, `data/`, UI |
| `screens/` | `selectors/`, `components/`, hooks | `engine/`, `data/` |

**Engines are pure**: no I/O, no clock, no randomness, no React. The current
date is always an argument, never read inside an engine. This is what makes the
financial logic exhaustively testable without a network, and what lets the
heavy compute pass move into a Web Worker as a configuration change rather than
a refactor. Both properties disappear the moment an engine reaches sideways.

---

## Financial correctness

These are not style preferences.

1. **A ratio may only be formed from two prices on the same basis.** Mixing
   `adjClose` and `close` across a 1:5 split reports a 5% gain as a 79% crash —
   and that stock is then ranked last, permanently. The engine refuses to
   produce a value rather than flagging one.
2. **Returns use adjusted close. Execution uses the next trading day's open.**
   No path may read a price that was not knowable at the decision moment.
3. **Live quotes never enter return maths.** A quote is unadjusted; dividing it
   by an adjusted month-end close breaks across any corporate action since.
   Quotes drive display columns only.
4. **Month-ends come from data presence, never calendar arithmetic.** Weekends
   and holidays are simply absent from the series.
5. **The live-momentum reference month-end is strictly BEFORE the current
   month.** Without that condition the engine divides today's price by itself,
   every stock reports exactly 0.00%, and the ranking silently degenerates into
   the alphabetical tie-break. This shipped once and passed a full suite,
   because it only manifests mid-month.
6. **A failure never produces a number.** No synthetic fallback, no
   interpolation, no zero-filling, no last-known-good silently substituted for
   live. An honest gap beats a plausible number.
7. **Never auto-adopt a replacement for a renamed or delisted ticker.** Flag and
   suggest; a human confirms. Adopting a guess pulls a different company's
   prices into the rankings with full confidence.
8. **RS is percentage POINTS.** Formatted `pp`, never `%`.
9. **Missing values are `null`, never `0`.** A zero price is a real price and a
   catastrophic one.

---

## TypeScript

Decision D8: incremental adoption. Measured before choosing —

| Configuration | Errors |
|---|---|
| `checkJs` + `strict` | 1,305 |
| `checkJs`, non-strict | 128 |
| current setting (strict on `.ts`/`.tsx` only) | 0 |

- **Every new file is `.ts` / `.tsx`.** No exceptions.
- `any` is prohibited. Use `unknown` plus narrowing.
- Nullable financial values are `number | null` — never optional-and-assumed.
  Optional-and-assumed is exactly how a missing price becomes a `NaN`, and a
  `NaN` in a ranking is silent: it sorts somewhere plausible.
- A type assertion at a data boundary requires runtime validation beside it.
- Domain shapes live once, in `src/types/domain.d.ts`. Never redeclared.

---

## React

- Function components only, one per file, file named for the component.
- **Components never calculate.** They receive shaped props from selectors. A
  `.map()` for rendering is fine; a return calculation is not.
- Hooks are called unconditionally, at the top, in a fixed order — including in
  components that will redirect.
- **Never put a fresh object or array literal in a dependency array.** A `?? []`
  in a dependency position invalidates the memo on every render.
- Every list uses a stable domain key (the symbol), never an index.
- No `dangerouslySetInnerHTML`, anywhere.

---

## State

Five categories, one home each. **A value living in two places is a defect.**

| State | Home |
|---|---|
| Fetched data | React Query + IndexedDB |
| Derived data | Memo — never persisted, never in a query key |
| Preferences | `localStorage` |
| User data (positions) | IndexedDB, versioned and migrated |
| Shareable view state | The URL |

**Query keys contain data parameters only.** A strategy parameter in a query key
means changing a window refetches 250 symbols instead of recomputing from bars
already in memory. This is a bug, and review must reject it.

If a value can be derived, derive it.

---

## Documentation

- **Every module carries a header stating what it owns and what it must never
  do.** This convention is why this codebase's subtlest invariants survived
  several ownership handoffs. It is mandatory.
- Comments explain **why**. A comment restating the code is deleted at review.
- Record a non-obvious financial decision **at the point where it can be
  violated**, not in a README nobody editing that line will open.
- Record rejected alternatives with their reason, so they are not relitigated.

---

## Errors

- Every failure carries a **kind** and a **scope**; scope determines UI
  treatment, and that mapping is fixed (`src/types/domain.d.ts`).
- **Engines throw on invalid input; callers catch and convert to flags.** A
  `NaN` propagating into a ranking is far worse than a throw at the point of
  failure.
- **Never swallow an error silently.** The historical cache's swallowed
  `QuotaExceededError` is the cautionary example: caching stopped working above
  ~100 symbols and nothing said so for months.

---

## Tests

- Unit tests for engines. Fast, pure, exhaustive, no mocks.
- **Golden master** for system output. Any change to a number fails the build
  and requires a recorded reason before the snapshot may be updated.
- **The regression set may never be deleted, skipped or weakened.** Each guards
  a bug that shipped while the suite was green:
  1. mid-month self-comparison
  2. calculator look-ahead
  3. transaction costs wired to nothing
  4. mixed price basis
  5. maskable-icon byte divergence
  6. theme pre-paint constant drift
  7. capital invariance of the strategy record
  8. cache quota headroom
  9. cold-load invocation count

---

## Commits and PRs

Conventional Commits with a layer scope:

```
feat(data): batch historical fetch into a single function invocation
fix(engine): refuse mixed adjClose/close ratios instead of flagging them
```

- Imperative, lower case, under 72 characters.
- **Any commit changing a financial number states the before and after in its
  body.** No exceptions.
- One logical change per commit. A commit needing "and" is two commits.
- `BREAKING CHANGE:` for a persisted-schema change, a removed URL, or a changed
  calculation convention.

The PR template is not optional, and "verification" means **pasted output**,
not a summary.

---

## Automatic rejection

A change is rejected without further discussion if it:

- leaves the suite red, or reduces the test count
- violates a layer boundary
- changes a number without updating the golden master and stating why
- deletes, skips or weakens a regression test
- introduces `any` in new TypeScript
- puts a financial calculation in a component
- introduces a fallback to synthetic or estimated market data
