#!/usr/bin/env python3
"""
Generate the Gati PWA icon set from the supplied master artwork.

    python3 scripts/generate-icons.py brand-src/LOGO.png

WHY THIS IS A SCRIPT AND NOT A ONE-OFF
Icons get regenerated (new size required, artwork replaced, a maskable
crop found to be wrong on a real device). Doing it by hand means the
next person guesses at the numbers below. Everything that matters —
the crop box, the safe-area ratio, the navy — is measured off the
master and recorded here, with the derivation.

WHAT THE MASTER ARTWORK IS (v2, supplied 2026-08-08)
A 948x944 render of a rounded-square card carrying the mark, floating
in a dark field with a warm gold glow bleeding in from the top right.
The glow is *staging*, not the icon. An app icon that contains a
smaller rounded card inside the OS's own rounded tile reads as an
amateur mistake, so we crop to the card and let it fill the tile.

    CARD_BOX was measured by scanning inward from each edge for the
    first pixel brighter than the staging, along the middle third of
    each side (clear of the corner radius, which pulls edges inward).
    Result: left 8, top 9, right 938, bottom 934.

THE GOLD BORDER IS PART OF THE ARTWORK — AND IT CHANGES THE MASKABLE MATH
The v1 master had no visible border, so clipping a corner only cost a
few pixels of navy and nobody could see it. This master has a thin gold
rule tracing the card's own outline. Clip a corner now and you ship a
gold ring with a bite taken out of it, on every Android home screen.

So the maskable variants must fit the WHOLE CARD inside Android's safe
circle (80% of tile diameter, radius 0.40T), not merely the mark:

    a rounded square of side s, corner radius r = 0.18s, has its
    outermost point at  sqrt(2) * (s/2 - r) + r  =  0.6326s

    require  0.6326s <= 0.40T   ->   s <= 0.632T

MASKABLE_SCALE is therefore 0.63, down from v1's 0.78. That is not a
regression — 0.78 was correct for artwork with nothing at its corners
worth protecting. The value is asserted below so it cannot drift.

CORNER RADIUS
The card's own rounding was measured off the master by fitting the
border contour: r ~= 165px on a 930px card = 0.177. RADIUS_RATIO 0.18
therefore traces the artwork's real outline rather than cutting across
it — the same value v1 used, which is why the mask still lands cleanly.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

# Measured from the master render — see module docstring.
CARD_BOX = (8, 9, 938, 934)

# The card's own corner rounding, as a fraction of its side.
RADIUS_RATIO = 0.18

# Derived, not chosen — see docstring. Asserted at run time.
MASKABLE_SCALE = 0.63
ANDROID_SAFE_RADIUS = 0.40

# Sampled from four quiet regions of the card interior, away from any
# stroke and away from the internal glow. The app's --color-chrome is a
# lighter navy than this; the icon keeps the artwork's own value so the
# repainted corners match the card exactly.
NAVY = (3, 15, 30)

OUT = Path('public/icons')

# The launch splash logo. Not under public/icons — see INTERMEDIATE below for
# why that directory is kept to exactly the precached set.
SPLASH = Path('public/brand/gati-splash.webp')

# The squared-up card, before sizing. Useful for eyeballing a new master,
# but it is an INTERMEDIATE and must not live under public/ — anything in
# public/icons is picked up by the PWA `includeAssets` glob and precached
# by the service worker, so a 1 MB working file becomes 1 MB every user
# downloads on install. Keep it beside the master instead.
INTERMEDIATE = Path('brand-src/gati-master-card.png')


def outer_radius_fraction(radius_ratio):
    """Distance from centre to the outermost point of a rounded square,
    as a fraction of its side. This is the number the safe circle has to
    accommodate."""
    return 2 ** 0.5 * (0.5 - radius_ratio) + radius_ratio


def rounded_mask(size, radius_ratio=RADIUS_RATIO):
    """Alpha mask matching the card's own corner rounding."""
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=int(size * radius_ratio), fill=255
    )
    return mask


def card(master):
    """The card, cropped out of its presentation staging, squared up.

    The render is 930x925 at the card — very slightly off-square. We pad
    rather than stretch: a 0.5% vertical distortion is invisible in
    isolation and obvious next to the wordmark."""
    crop = master.crop(CARD_BOX)
    side = max(crop.size)
    square = Image.new('RGB', (side, side), NAVY)
    square.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    return square


def standard(src, size):
    """
    Full-bleed icon. The card's own rounded corners leave slivers of the
    old background behind, so we repaint the corners with solid navy —
    otherwise the OS's rounding exposes a slightly-off navy at each corner.
    """
    tile = Image.new('RGB', (size, size), NAVY)
    art = src.resize((size, size), Image.LANCZOS)
    tile.paste(art, (0, 0), rounded_mask(size))
    return tile


def maskable(src, size):
    """The whole card, scaled to clear Android's 80%-diameter safe circle."""
    tile = Image.new('RGB', (size, size), NAVY)
    inner = int(size * MASKABLE_SCALE)
    art = src.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    tile.paste(art, (off, off), rounded_mask(inner))
    return tile


def transparent_mark(src, size):
    """
    For inline UI use (app bar, sidebar): rounded, with real transparency.

    192px, not 128. The mark is drawn at 34px in the app bar and 40px in the
    desktop rail (v1.4.0, up from 24 and 28). At a 4x device pixel ratio a
    40px render asks for 160 device pixels, so a 128px source would have been
    upscaled — on the one element that is pure brand, where softness is the
    only thing anybody would notice.

    192 covers 48px at 4x with room spare, and costs ~30 kB precached once.
    """
    art = src.resize((size, size), Image.LANCZOS).convert('RGBA')
    art.putalpha(rounded_mask(size))
    return art


def splash_asset(src):
    """
    The launch splash logo. Transparent corners, so it sits on the splash's
    own background rather than carrying a navy square of its own.

    WHY WEBP AND WHY THIS SIZE
    This asset is on the critical path of the very first paint, before the
    service worker exists to cache anything, so its weight is felt on every
    cold start. Measured at 768px: PNG 541 kB, lossless WebP 351 kB,
    WebP q88 42 kB. Fidelity against the PNG over opaque pixels is a mean
    channel error of ~2/255 — invisible at any size this renders at.

    768px covers the largest size the splash ever draws (320 CSS px) at 2x,
    and a 218 CSS px phone render at 3x. Going higher costs bytes on first
    paint for resolution no device asks for.

    A browser without WebP also lacks `mask-image`, so it would lose the
    sweep anyway; SplashScreen degrades to the app starting immediately
    rather than to a broken frame.
    """
    size = 768
    art = src.resize((size, size), Image.LANCZOS).convert('RGBA')
    art.putalpha(rounded_mask(size))
    return art


def main():
    reach = outer_radius_fraction(RADIUS_RATIO) * MASKABLE_SCALE
    assert reach <= ANDROID_SAFE_RADIUS, (
        f'maskable card reaches {reach:.4f} of the tile but Android only '
        f'guarantees {ANDROID_SAFE_RADIUS}. Lower MASKABLE_SCALE.'
    )

    master_path = sys.argv[1] if len(sys.argv) > 1 else 'brand-src/LOGO.png'
    master = Image.open(master_path).convert('RGB')
    if master.size != (948, 944):
        print(f'note: master is {master.size}, CARD_BOX was measured on 948x944')

    OUT.mkdir(parents=True, exist_ok=True)
    src = card(master)
    INTERMEDIATE.parent.mkdir(parents=True, exist_ok=True)
    src.save(INTERMEDIATE)

    written = []
    for name, img in [
        ('icon-512.png', standard(src, 512)),
        ('icon-192.png', standard(src, 192)),
        ('apple-touch-icon.png', standard(src, 180)),
        ('favicon-32.png', standard(src, 32)),
        ('icon-maskable-512.png', maskable(src, 512)),
        ('icon-maskable-192.png', maskable(src, 192)),
        ('gati-mark.png', transparent_mark(src, 192)),
    ]:
        path = OUT / name
        img.save(path, optimize=True)
        written.append(f'{name:26} {img.size[0]}x{img.size[1]:<4} {path.stat().st_size:>7,}B')

    SPLASH.parent.mkdir(parents=True, exist_ok=True)
    splash = splash_asset(src)
    splash.save(SPLASH, quality=88, method=6)
    written.append(
        f'{SPLASH.name:26} {splash.size[0]}x{splash.size[1]:<4} '
        f'{SPLASH.stat().st_size:>7,}B   -> {SPLASH.parent}'
    )

    print(f'card {src.size[0]}x{src.size[1]}   maskable reach {reach:.4f} of tile '
          f'(safe {ANDROID_SAFE_RADIUS})\n')
    print('\n'.join(written))


if __name__ == '__main__':
    main()
