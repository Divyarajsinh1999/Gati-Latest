# App icons

**Do not hand-edit these files.** They are generated from the master
artwork by `scripts/generate-icons.py`:

```bash
python3 scripts/generate-icons.py brand-src/LOGO.png
```

| File | Used by |
|---|---|
| `icon-192.png`, `icon-512.png` | PWA manifest, `purpose: any` |
| `icon-maskable-192.png`, `icon-maskable-512.png` | PWA manifest, `purpose: maskable` |
| `apple-touch-icon.png` | iOS home screen |
| `favicon-32.png` | browser tab |
| `gati-mark.png` | inline mark in the app bar and sidebar (transparent corners) |

**Nothing else belongs in this directory.** The PWA `includeAssets` glob
sweeps `icons/*.png` and the service worker precaches every match, so a
working file left here is downloaded in full by every user on install.
The generator's intermediate card goes to `brand-src/`, and a test fails
the build on any file here that is not in the table above.

**The maskable files are separate artwork, not the same image re-tagged.**
Android crops a maskable icon to a circle of 80% diameter. This artwork
carries a thin gold rule around the card's outline, so the maskable
variants must fit the *whole card* inside that circle — not merely the
mark. The derivation gives a maximum of 0.632 of the tile; the script
uses **0.63** and asserts it. Re-tagging the standard icon is the single
easiest way to ship a gold ring with a bite out of it — don't.

Rationale and the full measurement notes: `docs/BRAND.md`.
