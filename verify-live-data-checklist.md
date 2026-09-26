# Live-data verification checklist

Everything in `netlify/functions/` was written to match Yahoo Finance's
documented/observed behavior, but this project was built in a sandbox that
could reach npm/PyPI/GitHub but not `finance.yahoo.com` — so none of it has
been exercised against a real response yet. This doc + the script next to
it (`verify-live-data.mjs`) turn "go verify it live" into a fixed,
~10-minute task instead of an open-ended one.

**The script has already been self-tested** against a mock server built
from the actual shipped function code (not a re-implementation) — once
with everything behaving correctly (13/13 checks passed) and once with two
specific things deliberately broken, to confirm the checker actually
catches failures rather than rubber-stamping (11/13 passed, and only the
two broken checks were flagged, with correctly-targeted hints). So the
checker itself is trustworthy; what's unverified is only the real Yahoo
behavior underneath it.

## Steps

1. **Install the Netlify CLI** if you haven't: `npm install -g netlify-cli`
2. **Start the dev server** (runs both Vite and the Netlify Functions locally):
   ```bash
   netlify dev
   ```
   Leave this running in one terminal.
3. **Run the verification script** in another terminal:
   ```bash
   node scripts/verify-live-data.mjs
   ```
   It auto-detects the right path. These functions declare custom routes, so
   Netlify serves them at `/api/*` rather than the legacy
   `/.netlify/functions/*`; the script probes both and uses whichever
   answers with JSON. Pass a base URL explicitly only if you run on a
   non-default port:
   ```bash
   node scripts/verify-live-data.mjs http://localhost:9999/api
   ```
4. **Read the report.** 14 checks run automatically; a summary line and a
   `scripts/verify-live-data-results.json` file are produced either way.

## What "done" looks like

All 13 checks pass, and in particular:

- Check 4 (`GVT&D.NS`) passes — this ticker for GE Vernova T&D India was
  *derived* from a Screener.in URL slug during config research, never
  independently confirmed against Yahoo. If this is the one check that
  fails, it's a wrong ticker, not a broken fetch mechanism — fix it in
  `src/config/universes.js`, not in the function code.
- Checks 5-7 (the three benchmarks) pass — a live Yahoo *quote page*
  existing for `NIFTYMIDCAP150.NS`/`NIFTYSMLCAP250.NS` (confirmed via web
  search while building this) is not the same thing as this programmatic
  chart endpoint actually serving them. If a stock check passes but a
  benchmark check fails, every backtest for that universe is broken even
  though the data layer looks fine at a glance.
- Every check's detail line reports `authTier=simple` or `authTier=crumb`.
  This is the actual answer to the open question this whole exercise
  exists to settle — research surfaced conflicting, differently-dated
  evidence on whether Yahoo currently requires the cookie+crumb handshake
  for this endpoint. Whichever tier consistently fires in your results is
  the real current answer; if it's always `simple`, the crumb-handling code
  in `market-data.js`/`quote.js` is dead weight you could simplify later
  (but leave it — it's a correct, tested fallback, just possibly unused).

## If something fails

The script prints targeted hints based on exactly which checks failed —
read those first. Beyond that:

- **Checks 1-3 fail (baseline, `M&M.NS`, `BAJAJ-AUTO.NS`):** the fetch
  mechanism itself is broken. Check the raw response with `curl` directly
  before touching any code:
  ```bash
  curl "http://localhost:8888/.netlify/functions/market-data?symbol=RELIANCE.NS&start=2025-01-01&end=2025-01-31"
  ```
  If Yahoo has changed the endpoint shape or blocking behavior since this
  was written, this is where it'll show up first.
- **Check 10 (invalid symbol) fails:** Yahoo's error response shape for
  unknown tickers may have changed — compare the raw response against
  `notFoundResult()`'s assumed shape (only referenced in the self-test
  mock, not shipped, but the assumed shape is documented in
  `market-data.js`'s `normalizeChartResult` and error-handling branch).
- **Check 13 (batching) fails:** confirms `quote.js` is really grouping
  symbols per Yahoo call rather than silently falling back to one request
  per symbol — if it fails, check `BATCH_SIZE` and the `batches` count in
  the response.
- **Check 14 (burst) shows rate limiting:** expected at some volume — the
  real app will eventually fetch ~450 symbols (50 + 150 + 250 across the
  three universes, plus 3 benchmarks). This check is informational by
  design specifically so a first sign of throttling shows up here, in a
  contained 8-request test, rather than surfacing later as a
  half-populated dashboard. If it shows up, the fix is batching/staggering
  requests in `dataService.js`, not anything in the functions themselves.

## What this checklist does NOT cover

- Full-range fetches (Jan 2025 → today, ~19 months) for all ~450 symbols
  at once — the checks above intentionally use short 1-month windows to
  stay fast. Once the 13 checks pass, a reasonable next step (not
  automated here) is a single full-range pull for one symbol to confirm
  Yahoo doesn't truncate or paginate very long ranges differently.
- Whether Yahoo's IP-based rate limiting or anti-bot posture differs
  between a local `netlify dev` run and an actual deployed Netlify
  function — those can have different source IPs/reputations. A clean
  local run is a strong signal, not an absolute guarantee, that production
  will behave the same way.
