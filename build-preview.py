#!/usr/bin/env python3
"""
Bundle the preview build into ONE self-contained HTML file.

    VITE_DATA_PROVIDER=mock npx vite build --config vite.config.preview.js
    python3 scripts/build-preview.py

Produces dist-preview/gati-app-preview.html, which opens with no server
and no network.

WHY THIS IS A SCRIPT
The first two attempts at this were done by hand and both shipped broken:
once with BrowserRouter (blank page, no error), once with the app icon
missing. Both were silent failures — the file looked fine until opened.
So this script asserts its own output at the end rather than trusting it.

THE ICON GOTCHA, RECORDED SO IT ISN'T REDISCOVERED
`Navigation.jsx` and `AppBar.jsx` reference the mark as a plain string
(`src="/icons/gati-mark.png"`), not an ESM import. Vite therefore does not
process it — correct for a `public/` asset served from a web root, but it
leaves an absolute path that resolves to nothing from `file://`.
Rewriting it here needs a QUOTE-AGNOSTIC match: the minifier emits
backticks, not the double quotes the source used, which is exactly how
the first fix missed.
"""
import base64
import pathlib
import re
import sys

DIST = pathlib.Path('dist-preview')
OUT = DIST / 'gati-app-preview.html'


def data_uri(path: pathlib.Path, mime: str) -> str:
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode()


def main() -> int:
    for required in ('preview.html', 'app.css', 'app.js'):
        if not (DIST / required).exists():
            print(f'error: {DIST/required} missing — run the vite preview build first')
            return 1

    html = (DIST / 'preview.html').read_text()
    css = (DIST / 'app.css').read_text()
    js = (DIST / 'app.js').read_text()

    # Inline every /icons/*.png the bundle references, whatever quote style
    # the minifier chose. Quote-agnostic on purpose — see module docstring.
    inlined = 0
    for icon in sorted((DIST / 'icons').glob('*.png')):
        uri = data_uri(icon, 'image/png')
        pattern = re.compile(r'([\'"`])(?:\.)?/icons/' + re.escape(icon.name) + r'\1')
        js, n = pattern.subn(lambda m: f'{m.group(1)}{uri}{m.group(1)}', js)
        inlined += n

    html = re.sub(r'<link[^>]*href="\./app\.css"[^>]*>', lambda _: f'<style>\n{css}\n</style>', html)
    html = re.sub(r'<script[^>]*src="\./app\.js"[^>]*></script>', '', html)
    html = html.replace('</body>', f'<script type="module">\n{js}\n</script>\n</body>')

    OUT.write_text(html)

    # Assert the output rather than assuming it. Each of these corresponds
    # to a way this has actually shipped broken.
    problems = []
    if 'app.css' in html or 'app.js' in html:
        problems.append('an external asset reference survived — the file is not self-contained')
    if re.search(r'[\'"`]/icons/', html):
        problems.append('an /icons/ path survived — it will 404 from file://')
    if 'HashRouter' not in js and 'hashchange' not in js:
        problems.append('no hash routing found — BrowserRouter renders blank in a sandboxed iframe')
    if inlined == 0:
        problems.append('no icons were inlined — check the quote-style match')

    print(f'{OUT}  {OUT.stat().st_size:,} bytes  ({inlined} icon reference(s) inlined)')
    if problems:
        for p in problems:
            print(f'  FAIL: {p}')
        return 1
    print('  self-contained: yes')
    return 0


if __name__ == '__main__':
    sys.exit(main())
