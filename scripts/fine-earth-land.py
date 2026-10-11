"""
The intro's Earth grows about fifty times over before the map takes its place. The land picture is
720 px across, so on a phone each of its pixels became a block the size of a fingertip and the coast
turned into a staircase. This redraws the same land four times finer, with the coast as a clean
curve, for the phone apps (the web keeps the small one: a browser scales the picture it has already
drawn, so a finer file there is only a longer download).

    python3 scripts/fine-earth-land.py

Reads assets/images/intro/earth-land.png, writes earth-land-fine.png beside it.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent.parent / "assets/images/intro"
TIMES = 4
LAND = np.array([242, 238, 229], dtype=np.float32)
COAST = np.array([154, 164, 182], dtype=np.float32)

src = np.asarray(Image.open(HERE / "earth-land.png").convert("RGBA"), dtype=np.float32) / 255
alpha = src[..., 3]
# The picture is three things: the land (and its coast line, both nearly solid), and a faint white
# grid over the sea. Told apart by how solid they are.
solid = np.clip((alpha - 0.2) / 0.6, 0, 1)
grid = np.where(alpha < 0.12, alpha, 0)

# The land's edge, enlarged smoothly and then tightened: enlarging alone leaves a wide soft band,
# and the tightening is what turns the staircase into a line.
edge = ndimage.zoom(ndimage.gaussian_filter(solid, 0.6), TIMES, order=3)
land = np.clip((edge - 0.5) * 3.0 + 0.5, 0, 1)
# The coast line: a thin band just inside the edge.
coast = np.clip(1 - np.abs(edge - 0.62) / 0.14, 0, 1) * 0.55
grid = np.clip(ndimage.zoom(grid, TIMES, order=1), 0, 1) * (1 - land)

h, w = land.shape
out = np.zeros((h, w, 4), dtype=np.float32)
colour = LAND * (1 - coast[..., None]) + COAST * coast[..., None]
a = land + grid * (1 - land)
out[..., :3] = np.where(a[..., None] > 0, (colour * land[..., None] + 254 * grid[..., None]) / np.maximum(a[..., None], 1e-6), 0)
out[..., 3] = a * 255

picture = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
# Few colours, so a palette keeps the file small.
picture = picture.quantize(colors=64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
picture.save(HERE / "earth-land-fine.png", optimize=True)
print(picture.size, (HERE / "earth-land-fine.png").stat().st_size)
