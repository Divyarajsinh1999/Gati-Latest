GATI — Release Candidate 1
==========================
Version: v1.2.0-rc.1
Frozen:  7 Aug 2026

WHAT THIS IS
------------
The complete source project, M1 through M12. Nothing is omitted except
node_modules and the build output, both of which regenerate.

START HERE
----------
  NEXT_CHAT_HANDOFF.md   Paste into a new chat to restore full project context
  REVIEW_CHECKLIST.md    Your manual testing checklist
  DECISIONS.md           The sixteen decisions, with reasoning
  CHANGELOG.md           Every milestone with its measurements

RUNNING IT LOCALLY
------------------
  npm install
  npm run dev             http://localhost:5173  (uses mock data by default)
  npm run verify          lint, typecheck, tests, build, bundle, performance

  For live data locally you need the serverless functions:
  npx netlify dev         then open the port it prints

DEPLOYING
---------
A ready-to-deploy build is provided SEPARATELY as gati-v1.0.0-rc1-netlify.zip.
Unzip it and drag the folder onto https://app.netlify.com/drop.

That folder contains the built site, netlify.toml, and the two serverless
functions. THE FUNCTIONS ARE NOT OPTIONAL: a browser cannot call Yahoo Finance
directly (CORS), so every price comes through /api/history and /api/quote.

VERIFIED BEFORE PACKAGING
-------------------------
  lint clean · typecheck clean · 1379 tests passing (58 files) · build clean
  index 42.8 kB gzip / 60 kB      initial payload 120.9 kB / 200 kB
  heavy pass 149ms / 250ms        accessibility 0 serious, 0 critical

  Against live Yahoo Finance:
  RELIANCE.NS previous month-end -> 2026-07-31, adjClose 1307.80
  Recomputed three times: identical.

TWO HARMLESS LEFTOVERS, REPORTED NOT FIXED
------------------------------------------
The freeze instruction was explicit, so these are noted rather than changed:

  1. vite.config.preview.js references preview.html, which was removed as dead
     code in M10. The file is unused by npm run build and npm run dev; it would
     only fail if invoked directly. Safe to delete whenever convenient.

  2. src/pages/ is an empty directory. Its last occupant was deleted in M8.

DELIBERATELY UNWIRED — DO NOT DELETE
------------------------------------
  src/compute/deriveUniverse.js
  src/compute/computeScheduler.js

Complete, tested, and intentionally not connected (decision D16). They are the
Web Worker escape hatch for the heavy pass. A dead-code scan WILL flag them.
Do not delete them, and do not wire them without a measured bottleneck.
Both files carry this warning in their own headers.
