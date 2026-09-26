# Contextual help — specification

Implements decision **D9**. This is the spec M4 builds against; the content it
displays lives in `src/config/glossary.js`.

---

## The principle

**Gati must stay understandable to someone returning after months or years.**

Any metric, term or calculation that is not immediately obvious carries a small
information icon. Tapping it explains what it means, why it matters, and how to
read it here. The explanation is available on demand and invisible otherwise.

This is not a help system bolted on. It follows directly from two things the
product already claims: *clarity over complexity*, and *every number must be
checkable*. A number the reader cannot interpret is not checkable however
precisely it was computed — an unexplained Sortino ratio fails in the same way
a wrong one does, just more quietly.

It also serves the beginner-first density baseline. The depth a quant wants is
present, one tap away, without raising the default density for anyone else.

---

## The component — `InfoTip`

### Visual

| Property | Value |
|---|---|
| Icon | Lowercase `i` in a circle, outline only, 1.5px stroke on the 24px grid |
| Size | **14px**, rendered at 16px optical box |
| Colour at rest | `--color-ink-muted` |
| Colour on hover/focus | `--color-gold` |
| Placement | Immediately after the label, 4px gap, baseline-aligned |
| Tap target | 44 × 44px, achieved by padding — **the icon itself stays 14px** |

The icon is deliberately the quietest interactive element in the interface. It
must never compete with the number it sits beside; if a reader notices the
icons before the data, the size or contrast is wrong.

### Behaviour

| Surface | Presentation |
|---|---|
| Desktop | Popover anchored to the icon, E3, 280px max width |
| Mobile | Bottom sheet, E4, dismiss by swipe / backdrop / `Esc` |

- Opens on **click or tap**, never on hover alone. Hover-only would make it
  unreachable on touch and would fire constantly while reading a dense table.
- Desktop may additionally show it on hover **after a 400ms delay**, as a
  convenience — but click remains the primary path.
- One open at a time. Opening another closes the first.
- Closes on `Esc`, on backdrop, and on scroll of the underlying page.
- **Never blocks or delays the number it explains.**

### Content layout — two tiers (D11)

```
TERM                          ← card title

── DEFAULT TIER, always shown ──
What it is                    ← one short sentence
Why it matters                ← one short sentence
In Gati                       ← one short sentence, product-specific

── LEARN MORE, collapsed ──
[ Learn more ⌄ ]
In more detail
Example                       ← concrete figures, never "suppose X"
Where it misleads             ← mandatory
Formula                       ← only where the formula IS the meaning

[ See also: <term> → ]        ← quiet link, when present
[ Full methodology → ]        ← quiet link, when present
```

**The default tier must never overwhelm.** Three short sentences, readable at a
glance. A single explanation has to choose between the beginner it would
overwhelm and the quant it would bore, and it always fails one of them —
splitting lets the default be genuinely short without losing the depth.

Sections are always labelled. Unlabelled paragraphs read as one blob and the
reader loses track of which question is being answered.

**Learn more collapses again whenever the panel closes.** Reopening always
starts at the short answer, never where the previous reader left it.

### Accessibility

- The trigger is a real button with an accessible name: `About {term}`.
- The panel is associated with its trigger and announced on open.
- Focus moves into the panel on open and **returns to the trigger** on close.
- `Esc` closes from anywhere within it.
- The icon is never the only indication that help exists — the label itself is
  part of the tap target on mobile.
- Contrast at rest must clear 4.5:1; `ink-muted` does in both themes.

---

## Where icons appear

**Always:**
- Every metric tile label
- Every chart title where the chart's meaning is not self-evident
- Every column header carrying a computed value (RS, rank, returns)
- Every Investment Simulator output (efficiency, drag, idle cash, the gap)
- Every data-quality notice term (thin sample, survivorship bias, stale data)

**Never:**
- Inside a stock row that is already one tap target — it would create a second
  target within the first and make the row ambiguous. The explanation for a
  column belongs on its **header**.
- Beside plain-language labels that need no gloss ("Stock", "Price", "Date")
- More than **one per label**
- More than **six visible on one screen without scrolling** — beyond that the
  interface is signalling that the screen itself is too jargon-dense, and the
  fix is the screen, not more icons

---

## Writing rules

Enforced by `src/config/__tests__/glossary.test.js`, which fails the build on
a violation.

1. **Default tier: three short sentences** — what it is · why it matters · in
   Gati. Each under 170 characters, one sentence, enforced by test.
1b. **`inGati` must be product-specific.** An entry that reads identically in
   any other app is a textbook definition wearing a costume. Enforced by test
   against a list of Gati-specific anchors.
1c. **Learn more is mandatory** and always carries detail, a concrete example
   with real figures, and limitations. A metric with no stated weakness is
   being oversold.
1d. **Formula only where the formula is the meaning.** Relative Strength is a
   subtraction and showing it clarifies; Sharpe's denominator helps nobody
   decide anything. Enforced by test in both directions.
2. **No jargon inside the explanation of jargon.** An entry that needs a second
   entry to be understood has failed. "Risk-adjusted return" and "standard
   deviation" are rejected by test.
3. **No circular definitions.** "Relative Strength is a measure of relative
   strength" is rejected by test.
4. **Concrete over abstract.** "A 20% drawdown means ₹1,00,000 fell to ₹80,000"
   beats "peak-to-trough decline".
5. **Honest about limits.** Where a metric is unreliable on a short sample, the
   entry says so. Sharpe, Sortino and CAGR are checked for this by test.
6. **No exclamation marks, no reassurance, no false cheer.** Rejected by test.
7. **Length:** each section over 30 characters, all three under 900 together.
   Longer belongs in Methodology with a link.
8. **Percentage points, not percent,** wherever RS is described. Checked by test.

---

## Adding a new metric

1. Write the entry in `src/config/glossary.js`.
2. Add its key to `TERMS_THE_UI_RENDERS` in the test.
3. Render the `InfoTip` beside the label.

Steps 1 and 2 are enforced: the test fails if a listed term has no entry, and
also if an entry exists that the UI never shows — an unreachable explanation is
text nobody will ever correct when it goes out of date.

The list is maintained by hand rather than scraped from components. Scraping
would pass silently whenever a label changed shape, which is exactly the decay
this is meant to prevent.
