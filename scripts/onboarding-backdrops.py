# Makes the intro's full-screen backgrounds from the bundled place photos: the photo sharp at the
# top (its sky under the wordmark), melting into a soft, darker blur at the bottom where the words
# sit, so white type stays readable without a panel. Baked in, so phones don't blur live.
# Run from the app folder: python3 scripts/onboarding-backdrops.py  (needs Pillow)
# Sources are the original photos from before they were re-encoded for the web (git f5b95da^),
# so this doesn't compress an already-compressed copy again.
import io
import subprocess
from PIL import Image, ImageFilter

W, H = 720, 1560  # a phone's shape, 2x
PAGES = {'video': 'gok-om', 'friends': 'gok-halfmoon', 'weekend': 'gok-kudle', 'you': 'hero-dusk'}
INK = (8, 12, 26)


def original(name):
    raw = subprocess.run(['git', 'show', f'f5b95da^:assets/images/places/{name}.jpg'], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(raw)).convert('RGB')


def ramp(y, a, b):
    return 0.0 if y <= a else 1.0 if y >= b else (y - a) / (b - a)


for page, name in PAGES.items():
    src = original(name)
    # Cover: the middle of the photo at the screen's shape.
    sw, sh = src.size
    if sw / sh > W / H:
        cw = round(sh * W / H)
        src = src.crop(((sw - cw) // 2, 0, (sw - cw) // 2 + cw, sh))
    else:
        ch = round(sw * H / W)
        src = src.crop((0, (sh - ch) // 2, sw, (sh - ch) // 2 + ch))
    sharp = src.resize((W, H), Image.LANCZOS)
    soft = sharp.filter(ImageFilter.GaussianBlur(22))
    blur_mask = Image.new('L', (W, H))
    shade_mask = Image.new('L', (W, H))
    for y in range(H):
        t = y / H
        blur_mask.paste(round(255 * ramp(t, 0.40, 0.62)), (0, y, W, y + 1))
        # Darker toward the bottom: 0 above 40%, 55% by three quarters, 70% at the foot.
        shade = 0.55 * ramp(t, 0.40, 0.75) + 0.15 * ramp(t, 0.75, 1.0)
        shade_mask.paste(round(255 * shade), (0, y, W, y + 1))
    out = Image.composite(soft, sharp, blur_mask)
    out = Image.composite(Image.new('RGB', (W, H), INK), out, shade_mask)
    path = f'assets/images/onboarding/{page}.jpg'
    out.save(path, 'JPEG', quality=72, optimize=True, progressive=True)
    print(path, round(len(open(path, 'rb').read()) / 1024), 'KB')
