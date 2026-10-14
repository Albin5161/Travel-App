"""
The intro's Earth, from NASA's Blue Marble Next Generation (October, with topography and
bathymetry; public domain, NASA Earth Observatory). Seen from straight above the middle of India,
as `GLOBE_CENTRE` in src/components/onboarding/Globe.tsx says.

    python3 scripts/intro-earth.py path/to/world.topo.bathy.200410.3x21600x10800.jpg

The source is 29 MB, from
https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
and isn't kept in the repo. Writes, in assets/images/intro/:

- earth-day.jpg / earth-day-web.jpg: the whole side of the Earth facing us, the disc filling the
  picture less the art's rim (RIM in Globe.tsx).
- earth-near.webp: the middle of that same picture, four times finer, for the zoom on a phone: the
  Earth grows some thirty times over before the map takes its place, and the whole-disc picture is
  a blur by then. Its edges fade out, so it melts into the whole rather than ending at a line.
  (A browser scales the picture it has already drawn, so the web goes without.)
- earth-shade.png: the light, laid over both: the far side and the edge in shadow, a thin haze of
  air at the rim.
- earth-air.png: the glow of the air around the Earth, drawn behind it.

Needs numpy and Pillow.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
OUT = Path(__file__).resolve().parent.parent / "assets/images/intro"
LNG0, LAT0 = 80.0, 16.0
RIM = 4 / 300
# The close-up covers this much of the disc's width, about its middle.
NEAR = 0.25

src_path = Path(sys.argv[1])


def ortho(n: int, span: float, sample):
    """An n x n picture of the part of the facing side [-span, span] about the middle, in units
    of the disc's radius. Returns RGB and whether each pixel is on the Earth."""
    t = (np.arange(n) + 0.5) / n * 2 - 1
    u, v = np.meshgrid(t * span, -t * span)
    rho = np.hypot(u, v)
    on = rho <= 1
    c = np.arcsin(np.clip(rho, 0, 1))
    p0 = np.radians(LAT0)
    with np.errstate(invalid="ignore", divide="ignore"):
        lat = np.degrees(np.arcsin(np.cos(c) * np.sin(p0) + np.where(rho > 0, v * np.sin(c) * np.cos(p0) / rho, 0)))
        lng = LNG0 + np.degrees(np.arctan2(u * np.sin(c), rho * np.cos(c) * np.cos(p0) - v * np.sin(c) * np.sin(p0)))
    lng = (lng + 180) % 360 - 180
    return sample(np.nan_to_num(lat), lng), on


def sampler(img: Image.Image, lng_w: float, lat_n: float, deg_px: float):
    a = np.asarray(img, dtype=np.float32)
    h, w = a.shape[:2]

    def sample(lat, lng):
        x = (lng - lng_w) / deg_px - 0.5
        y = (lat_n - lat) / deg_px - 0.5
        x0 = np.clip(np.floor(x).astype(int), 0, w - 2)
        y0 = np.clip(np.floor(y).astype(int), 0, h - 2)
        fx = np.clip(x - x0, 0, 1)[..., None]
        fy = np.clip(y - y0, 0, 1)[..., None]
        top = a[y0, x0] * (1 - fx) + a[y0, x0 + 1] * fx
        bot = a[y0 + 1, x0] * (1 - fx) + a[y0 + 1, x0 + 1] * fx
        return top * (1 - fy) + bot * fy

    return sample


def grade(rgb):
    """A touch deeper and cooler than the source, so the Earth sits in a night sky rather than on it."""
    rgb = rgb / 255.0
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    rgb = lum[..., None] + (rgb - lum[..., None]) * 0.92
    rgb = np.power(np.clip(rgb, 0, 1), 1.08) * np.array([0.97, 0.99, 1.04])
    return np.clip(rgb * 255, 0, 255)


def save_jpg(rgb, on, name, size):
    # Off the Earth: the sky's own deep blue, never seen (the disc is cut by a circle) but it keeps
    # a soft edge from going light.
    rgb = np.where(on[..., None], rgb, np.array([14, 22, 44]))
    im = Image.fromarray(rgb.astype(np.uint8)).resize((size, size), Image.LANCZOS)
    im.save(OUT / name, quality=80, optimize=True, progressive=True)
    print(name, im.size, (OUT / name).stat().st_size)


full = Image.open(src_path)
# The whole side, from a quarter-size read of the source: plenty for a 2048-pixel disc.
quarter = full.copy()
quarter.draft("RGB", (full.width // 4, full.height // 4))
quarter = quarter.convert("RGB")
whole = sampler(quarter, -180, 90, 360 / quarter.width)

R = 1 / (1 - 2 * RIM)  # the picture's half-width, in disc radii
rgb, on = ortho(4096, R, whole)
rgb = grade(rgb)
save_jpg(rgb, on, "earth-day.jpg", 2048)
save_jpg(rgb, on, "earth-day-web.jpg", 1024)

# The close-up, at the source's full detail: a crop of the source around India, read whole.
deg = 360 / full.width
box = (int((40 + 180) / deg), int((90 - 55) / deg), int((125 + 180) / deg), int((90 + 15) / deg))
crop = full.crop(box).convert("RGB")
near = sampler(crop, -180 + box[0] * deg, 90 - box[1] * deg, deg)
rgb, on = ortho(2048, NEAR * R, near)
rgb = grade(rgb)
# Solid in the middle, fading to nothing over the outer fifth on every side.
t = (np.arange(2048) + 0.5) / 2048
edge = np.clip(np.minimum(t, 1 - t) / 0.2, 0, 1)
edge = edge * edge * (3 - 2 * edge)
fade = np.minimum(edge[:, None], edge[None, :])
rgba = np.dstack([np.where(on[..., None], rgb, 0), fade * 255]).astype(np.uint8)
Image.fromarray(rgba).save(OUT / "earth-near.webp", quality=80, method=6)
print("earth-near.webp", (OUT / "earth-near.webp").stat().st_size)

# The light: from the upper left, so the lower right falls away into shadow, with the edge darker
# all round (the Earth is a ball) and a thin haze of air just inside the rim.
n = 1024
t = (np.arange(n) + 0.5) / n * 2 - 1
u, v = np.meshgrid(t * R, -t * R)
rho = np.hypot(u, v)
inside = rho <= 1
z = np.sqrt(np.clip(1 - rho**2, 0, 1))
sun = np.array([-0.55, 0.45, 0.70])
sun = sun / np.linalg.norm(sun)
lit = np.clip(u * sun[0] + v * sun[1] + z * sun[2], -1, 1)
# Dark where the light can't reach, eased so the day side stays the picture's own colours.
night = np.clip((0.32 - lit) / 0.62, 0, 1) ** 1.4
limb = np.clip((rho - 0.62) / 0.38, 0, 1) ** 2.2
dark = np.clip(night * 0.78 + limb * 0.35, 0, 0.9)
haze = np.clip((rho - 0.9) / 0.1, 0, 1) ** 2 * np.clip(lit + 0.35, 0, 1) * 0.55
shade = np.zeros((n, n, 4), dtype=np.float32)
night_rgb = np.array([6, 10, 26], dtype=np.float32)
haze_rgb = np.array([150, 190, 255], dtype=np.float32)
a = dark + haze * (1 - dark)
shade[..., :3] = (night_rgb * dark[..., None] + haze_rgb * (haze * (1 - dark))[..., None]) / np.maximum(a[..., None], 1e-6)
shade[..., 3] = np.where(inside, a, 0) * 255
Image.fromarray(np.clip(shade, 0, 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS).save(OUT / "earth-shade.png", optimize=True)
print("earth-shade.png", (OUT / "earth-shade.png").stat().st_size)

# The air around it: a soft blue glow just outside the edge, strongest on the lit side. Drawn in
# a box twice the Earth's, so it has room to fade.
n = 512
t = (np.arange(n) + 0.5) / n * 2 - 1
u, v = np.meshgrid(t * 2, -t * 2)
rho = np.hypot(u, v)
side = np.clip((u * sun[0] + v * sun[1]) / np.maximum(rho, 1e-6) * 0.5 + 0.6, 0.25, 1)
glow = np.where(rho > 1, np.exp(-((rho - 1) / 0.07)), 1) * np.clip((rho - 0.9) / 0.1, 0, 1)
glow = glow * side * 0.6
air = np.zeros((n, n, 4), dtype=np.float32)
air[..., :3] = np.array([120, 170, 255])
air[..., 3] = glow * 255
Image.fromarray(np.clip(air, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)).save(OUT / "earth-air.png", optimize=True)
print("earth-air.png", (OUT / "earth-air.png").stat().st_size)
