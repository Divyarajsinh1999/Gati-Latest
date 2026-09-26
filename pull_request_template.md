<!--
Every field below exists because something went wrong once without it.
Delete nothing; write "n/a" where a section genuinely doesn't apply.
-->

## What changed and why

<!-- One paragraph. The diff shows what; explain why. -->

## Milestone

- **Milestone:** M_
- **Definition-of-Done items satisfied:**
- **Decision implemented (DECISIONS.md ref), or "none":**

## Does any displayed number change?

- [ ] **No** — no financial output is affected
- [ ] **Yes** — before/after stated below, and the golden master is updated with a recorded reason

<!--
If yes, state the before and after explicitly. Three financial bugs have
shipped in this project while a full test suite stayed green; every one was a
changed number that nobody was watching.
-->

## Verification

<!--
PASTE THE ACTUAL OUTPUT. Do not summarise, do not write "all green".
Run: npm run verify
-->

```
```

## Screenshots (any visual change)

<!-- 390px and 1280px, light and dark. -->

| | Light | Dark |
|---|---|---|
| **390px** | | |
| **1280px** | | |

## Self-review

- [ ] No financial calculation added to a UI component
- [ ] No layer boundary violated (lint would have caught it — confirm it ran)
- [ ] No regression test deleted, skipped, or weakened
- [ ] No `any` in new TypeScript
- [ ] No fallback to synthetic or estimated data introduced
- [ ] Version, `CHANGELOG.md` and `TODO.md` updated in this same commit
- [ ] New module headers state what the module owns and what it must never do
