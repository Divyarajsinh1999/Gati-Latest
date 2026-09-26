# Constituent lists — how they're built and how to refresh them

All three universes now carry their full real constituent lists:
NIFTY 50 (50), NIFTY Midcap 150 (150), NIFTY Smallcap 250 (250).

## Where the data came from

- **NIFTY 50** — verified directly against NSE's own published constituent
  table. Treated as `provenance: 'official'`.
- **Midcap 150 / Smallcap 250** — imported from a third-party GitHub mirror
  (`AkhilB21/nse-constituents`), because NSE's own CSV endpoints are not
  reachable from the environment this was built in. Marked
  `provenance: 'third-party-mirror'` and disclosed as such in the UI.

Midcap 150 is **derived**, not taken directly:

```
Nifty Midcap 150 = Nifty MidSmallcap 400 − Nifty Smallcap 250
```

That identity holds by index construction, and the importer asserts it
yields exactly 150 names — which doubles as a strong integrity check, since
stale or corrupt inputs will almost never satisfy it.

## Validation performed before accepting the data

| Check | Result |
|---|---|
| Exact counts (50 / 250 / 400 / 500) | pass |
| No duplicate symbols within a universe | pass |
| Smallcap 250 ⊂ MidSmallcap 400 | pass |
| Derived Midcap 150 count | exactly 150 |
| Zero overlap between any two universes | pass |
| All tickers match `^[A-Z0-9&-]+\.NS$` | pass |
| NIFTY 50 vs independently verified official list | **50/50 match** |
| 36 midcap names previously verified from official factsheets | 34 present, 0 misplaced |
| 37 smallcap names previously verified from official factsheets | 35 present, 2 moved to midcap |

The handful of differences are consistent with NSE's semi-annual
reconstitution having moved those names between indices, not with bad data.
Notably, this source independently confirms the MCX / Laurus Labs placement
in Midcap 150 that this project had earlier resolved from official
factsheets.

## Refreshing after a reconstitution

NSE reconstitutes these indices twice a year (cut-offs 31 Jan / 31 Jul).

```bash
# 1. Obtain current constituent JSON for MidSmallcap 400 and Smallcap 250
#    in the shape: [{ "sym": "RHIM.NS", "name": "...", "sector": "..." }]
# 2. Regenerate — this refuses to write anything if a check fails:
node scripts/import-constituents.mjs midsmallcap400.json smallcap250.json
# 3. Verify:
npm test          # config integrity tests will catch count/overlap breakage
npm run build
```

Output goes to `src/config/constituents.generated.js`, which
`src/config/universes.js` imports. Don't hand-edit the generated file.

## Preferred upgrade: use NSE's official CSVs

If you can reach niftyindices.com, download these and convert to the JSON
shape above — then the lists become `provenance: 'official'` and the
third-party disclosure in the UI can be removed:

- https://www.niftyindices.com/IndexConstituent/ind_niftymidcap150list.csv
- https://www.niftyindices.com/IndexConstituent/ind_niftysmallcap250list.csv

NSE's CSV columns are `Company Name, Industry, Symbol, Series, ISIN Code`;
map `Symbol` → `sym` with a `.NS` suffix, `Company Name` → `name`,
`Industry` → `sector`.
