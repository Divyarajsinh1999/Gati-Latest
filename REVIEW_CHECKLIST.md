# GATI — Review Checklist (RC1)

**Build:** v1.2.0-rc.1 · **Purpose:** your manual testing pass before v1.0.0

Work through what matters to you and skip the rest — this is a prompt, not
homework. For anything that fails, noting **screen · device · what you expected
· what happened** is usually enough to fix it precisely.

**Primary target: 390×844 (iPhone-class portrait).** If something works on
desktop and not on a phone, the phone wins.

---

## 0 · Before you start

- [ ] `/api/quote?symbols=RELIANCE.NS` returns JSON on the deployed site
- [ ] `/api/history?symbols=RELIANCE.NS&start=2025-01-01` returns JSON
- [ ] Settings shows a provider of `yahoo` (not `mock`) and an auth tier
- [ ] First load completes — ~450 stocks, a few seconds cold, then cached 6h

*If the API paths 404, the serverless functions did not deploy. Everything else
will look broken for that one reason.*

---

## 1 · Mobile usability — the priority

- [ ] **On first load, can you see the verdict AND all five stocks without
      scrolling?** This is the single most important layout claim in the product
- [ ] The investment amount field is reachable with a thumb, not a stretch
- [ ] Nothing is hidden behind the bottom navigation bar
- [ ] No horizontal scrolling anywhere
- [ ] Text is readable without zooming
- [ ] Tap targets feel comfortable — no mis-taps on ranking rows
- [ ] Rotating to landscape does not break a layout
- [ ] Installing to the home screen works and opens without browser chrome

---

## 2 · Desktop usability

- [ ] 1280px and 1920px both look composed, not stretched
- [ ] The left icon rail expands to labels on hover and does not shove content
- [ ] Cards do not become absurdly wide on a large display
- [ ] Charts stay legible at every width

---

## 3 · Navigation and workflow

- [ ] Five destinations: three universes, Reports, Settings
- [ ] The app opens on the universe you last used
- [ ] Switching universes **keeps your window** (1M/3M/6M/12M)
- [ ] Filter and sort also carry across universes
- [ ] Back from a stock returns you to the same scroll position in the ranking
- [ ] A URL like `/nifty50/3m` opens correctly when pasted fresh
- [ ] A bad URL (`/nifty50/9m`) lands somewhere sensible and explains why
- [ ] An old link (`/strategy/midcap150-rs-6m`) redirects **and keeps 6M**

---

## 4 · Relative Strength workflow — the core

- [ ] The Top 5 makes sense: highest RS first, rank 1 at the top
- [ ] RS is shown in **percentage points (pp)**, not percent
- [ ] The RS Ledger's visible gap matches the RS number beside it
- [ ] **Spot-check one stock against a second source** — the previous month-end
      close, the current-month %, and today's move
- [ ] The previous month-end date is a real trading day
- [ ] Changing the window visibly re-ranks, and quickly
- [ ] "New this month" / "Held" chips match the change summary
- [ ] Momentum Age looks plausible against the rank history

---

## 5 · Stock Detail

- [ ] Tapping any ranked row opens it
- [ ] All four windows appear; ones without enough history say so rather than
      showing 0.0pp
- [ ] The prior month-end price **and its date** are shown
- [ ] Rank history matches what the Record shows
- [ ] Back returns you where you were

---

## 6 · Investment Simulator

- [ ] Typing an amount updates share counts **instantly**, with no reload
- [ ] Share counts are whole numbers
- [ ] Invested + cash left = the amount you entered
- [ ] Presets (₹25k/₹50k/₹1L/₹5L) work
- [ ] At a small amount, unaffordable picks are flagged rather than shown as 0
- [ ] **The historical record above does NOT change when you change the amount**
      — this is decision D1 and the most important invariant in the product
- [ ] Your amount is remembered when you switch universes

---

## 7 · Charts

- [ ] Strategy is **solid gold**, benchmark **dashed grey** — everywhere
- [ ] Legend swatches show the dash pattern, not just colour
- [ ] Hovering the equity curve moves the drawdown crosshair with it
- [ ] Range buttons (3M/6M/1Y/3Y/5Y/All) all respond
- [ ] **Selecting 5Y explains that history is short** rather than looking broken
- [ ] The equity axis shows an index around 100 — **never a ₹ figure**
- [ ] "More charts" on the Record opens three further charts
- [ ] Contribution is in percentage points, not rupees

---

## 8 · Portfolio

- [ ] Adding a position takes under ~15 seconds on a phone
- [ ] The storage disclosure appears **before your first save**
- [ ] Stock search inside the form finds what you type
- [ ] Entering an amount converts to whole shares before saving
- [ ] Totals, P&L and weights look right
- [ ] "In Top 5" / "No longer in Top 5" is correct per holding
- [ ] Deleting asks for confirmation
- [ ] **Export produces a JSON file** — then clear site data and restore it
- [ ] Holdings appear as a summary block inside their own universe
- [ ] With no holdings, that block is **absent**, not an empty prompt

---

## 9 · Reports

- [ ] The three universes compare side by side, never summed
- [ ] The window matrix opens (a moment on first open) and all 12 cells populate
- [ ] Cells show the rebalance count as well as the figure
- [ ] Monthly history shows picks **and what changed** each month
- [ ] **All seven CSV exports download**, and the values match the screen
- [ ] The methodology version is stamped

---

## 10 · Search

- [ ] `/` opens search on desktop; the icon opens it on mobile
- [ ] It finds stocks across all three universes
- [ ] Typing a ticker prefix ranks it first
- [ ] Enter opens the result; Escape closes and returns focus
- [ ] It works with the network off

---

## 11 · Loading, errors and offline

- [ ] Skeletons on first load — no spinners, no jumping as content arrives
- [ ] **Turn airplane mode on:** cached data still shows, with an offline notice
- [ ] Offline with no cache gives an offline screen, not a generic error
- [ ] Turning the network back on recovers without a manual reload
- [ ] Error messages are plain English with no stack traces or jargon
- [ ] Empty states explain *why* and what to do next

---

## 12 · Accessibility

- [ ] Tab from the top: the **skip link** is the first stop
- [ ] The whole app is reachable by keyboard alone
- [ ] Focus is always visible
- [ ] Escape closes every dialog and returns focus where it was
- [ ] Shortcuts work: `1`/`2`/`3`, `R`, `,`, `/`, `?`
- [ ] Typing an amount does **not** trigger shortcuts
- [ ] Dark and light modes are both comfortable
- [ ] With reduced motion enabled, nothing is lost

---

## 13 · Contextual help

- [ ] Every metric has an ⓘ that opens a short explanation
- [ ] The default is genuinely short — three sentences
- [ ] "Learn more" expands with an example and its limitations
- [ ] Explanations refer to Gati, not generic textbook definitions
- [ ] Reopening starts at the short answer again

---

## 14 · Data integrity

- [ ] The status line honestly reflects market open/closed/holiday
- [ ] "Data as of" is today during market hours
- [ ] Excluded stocks are reported with a reason, never silently dropped
- [ ] Missing values show "—", never 0 or a guess
- [ ] No ₹ figure appears anywhere on the Strategy Record
- [ ] Survivorship bias is mentioned wherever a backtest appears

---

## 15 · Visual consistency

- [ ] Cards, spacing and borders feel the same across all screens
- [ ] Green means gain, red means loss, gold means benchmark/brand — always
- [ ] Nothing relies on colour alone
- [ ] Numbers align in columns (tabular figures)
- [ ] Terminology is consistent screen to screen

---

## 16 · Performance, by feel

- [ ] Opening the app feels fast on a warm cache
- [ ] Scrolling 250 rows is smooth
- [ ] Switching universes is instant
- [ ] Typing an amount has no lag
- [ ] Nothing stutters during a live refresh

---

## Reporting back

Most useful format:

```
Screen:     Full Ranking
Device:     iPhone 13, Safari
Expected:   Sparkline beside each row
Happened:   Nothing rendered below 400px width
Severity:   minor / annoying / wrong number / broken
```

**Flag anything that looks like a wrong number as highest priority** — a
layout problem is visible, a wrong figure is not.
