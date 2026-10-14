"""
The intro's map, from OpenStreetMap (© OpenStreetMap contributors, ODbL): every street, the coast
and the water around the sample's places, drawn as a handful of SVG paths; and, for the zoom in
from the Earth, the land for a few thousand kilometres around, from Natural Earth (public domain).
Written to src/data/introMaps.ts.

    python3 scripts/intro-maps.py DIR NATURAL_EARTH_LAND_SHP

DIR holds one Overpass answer (`[out:json]` ... `out geom;`) per sample, named as in AREAS below.
The query asked for highways, natural=coastline, natural=water, waterway=river|canal|stream inside
each area's box. (On 14 Oct 2026 Overpass kept timing out on Kochi, so kochi-roads.json was made
from four OpenStreetMap API `map` calls over the box, joined into the same shape, and
kochi-water.json left empty: the API's answer has the coast and water in it too.) Needs shapely.

The map is in its own units, a fixed number of metres each (`m` below) so the places spread over a
few hundred, as on the drawn city maps: the camera's fitting and padding work the same.

The land around (`region`) is in the same units, but placed as the intro's Earth shows it (seen from
straight above GLOBE_CENTRE in Globe.tsx) and then turned back by `toMap`, so that it agrees with
the street map near the places and with the Earth far from them. The intro turns it by `toEarth`
(the inverse) while the Earth is still in view, and eases that away as it closes in. The
shapefile is ne_10m_land.shp from naturalearthdata.com (not kept in the repo). Needs pyshp.
"""
import json
import math
import re
import sys
from pathlib import Path

from shapely.geometry import LineString, MultiLineString, Point, Polygon, box
from shapely.ops import linemerge, polygonize, unary_union

ROOT = Path(__file__).resolve().parent.parent
DIR = Path(sys.argv[1])
LAND_SHP = Path(sys.argv[2])
GLOBE_CENTRE = (80.0, 16.0)
REGION_STEP = 100
NEAR_STEP = 4
EARTH_R = 6_371_000

# The box is the part drawn, in degrees (south, west, north, east); `m` the metres in one map unit.
# Labels are real spots, set beside the places rather than on them.
AREAS = {
    "reel-kochi": {
        "files": ["kochi-roads", "kochi-water"],
        "box": (9.940, 76.222, 9.990, 76.280),
        "m": 3.8,
        "labels": [("FORT KOCHI", 9.9618, 76.2448), ("MATTANCHERRY", 9.9545, 76.2560)],
        "minor": True,
        # The harbour is part of Vembanad Lake, whose edge runs far outside the box: only pieces of
        # it come back, with no telling which side is water. There, a piece is land if it has
        # streets on it.
        "water_by_roads": True,
        # The dot on the Earth (PICK.at in IntroScene), and how far the land around reaches.
        "mark": (9.96, 76.24),
        "region_km": 2200,
        "near_km": 220,
        # The box the OpenStreetMap coastline was asked for (kochi-coast.json): south, west, north, east.
        "coast_box": (9.55, 75.95, 10.45, 76.60),
    },
}

MAJOR = {"motorway", "trunk", "primary", "secondary", "tertiary", "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link"}
MINOR = {"unclassified", "residential", "living_street", "pedestrian", "road"}
SMALL = {"service", "track", "path"}


def places():
    """Each sample place's id and real spot, read from the catalogue."""
    text = (ROOT / "src/data/catalog.ts").read_text()
    out = {}
    for m in re.finditer(r"id: '([a-z-]+)'[^}]*?coords: \{ lat: ([\d.]+), lng: ([\d.]+) \}", text, re.S):
        out[m.group(1)] = (float(m.group(2)), float(m.group(3)))
    reels = {}
    for m in re.finditer(r"'(reel-[a-z]+)': \{.*?placeIds: \[([^\]]*)\]", text, re.S):
        reels[m.group(1)] = re.findall(r"'([a-z-]+)'", m.group(2))
    return out, reels


def elements(files):
    els = []
    for f in files:
        els += json.loads((DIR / f"{f}.json").read_text())["elements"]
    return els


def num(v):
    return str(int(round(v)))


def path_of(lines, closed=False):
    """Lines as one SVG path, whole units, each move after the first relative."""
    parts = []
    for coords in lines:
        pts = [(round(x), round(y)) for x, y in coords]
        dedup = [pts[0]] + [p for i, p in enumerate(pts[1:]) if p != pts[i]]
        if len(dedup) < 2:
            continue
        s = f"M{dedup[0][0]} {dedup[0][1]}"
        px, py = dedup[0]
        for x, y in dedup[1:]:
            s += f"l{x - px} {y - py}"
            px, py = x, y
        parts.append(s + ("z" if closed else ""))
    return "".join(parts).replace(" -", "-")


def flat(geom):
    """Every line in a geometry (lines, multi-lines, collections)."""
    if geom.is_empty:
        return []
    if isinstance(geom, LineString):
        return [list(geom.coords)]
    if isinstance(geom, MultiLineString):
        return [list(g.coords) for g in geom.geoms]
    if hasattr(geom, "geoms"):
        return [c for g in geom.geoms for c in flat(g)]
    return []


def rings(geom):
    """Every ring of a polygon or several, outer and holes, for an even-odd fill."""
    if geom.is_empty:
        return []
    polys = [geom] if isinstance(geom, Polygon) else [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]
    out = []
    for p in polys:
        out.append(list(p.exterior.coords))
        out += [list(i.coords) for i in p.interiors]
    return out


def build(reel, cfg, spots, reel_places):
    s, w, n, e = cfg["box"]
    lat0, lng0 = (s + n) / 2, (w + e) / 2
    kx = 111_320 * math.cos(math.radians(lat0)) / cfg["m"]
    ky = 110_540 / cfg["m"]

    def proj(lng, lat):
        return ((lng - lng0) * kx, (lat0 - lat) * ky)

    x0, y0 = proj(w, n)
    x1, y1 = proj(e, s)
    frame = box(x0, y0, x1, y1)
    tol = 0.6

    roads = {"major": [], "minor": [], "small": []}
    coast, water, rivers, streams, edges, water_polys = [], [], [], [], [], []
    for el in elements(cfg["files"]):
        t = el.get("tags", {})
        geoms = []
        if el["type"] == "way" and "geometry" in el:
            geoms = [[proj(p["lon"], p["lat"]) for p in el["geometry"]]]
        elif el["type"] == "relation":
            part = lambda role: [LineString([proj(p["lon"], p["lat"]) for p in m["geometry"]]) for m in el.get("members", []) if m.get("role") == role and len(m.get("geometry", [])) >= 2]
            outers = flat(linemerge(part("outer"))) if part("outer") else []
            inners = flat(linemerge(part("inner"))) if part("inner") else []
            if all(r[0] == r[-1] for r in outers):
                # Whole: water, less its islands.
                for ring in outers:
                    if len(ring) >= 4:
                        lake = Polygon(ring).buffer(0)
                        for hole in inners:
                            if len(hole) >= 4:
                                lake = lake.difference(Polygon(hole).buffer(0))
                        water_polys.append(lake)
            else:
                # The edge runs out of the box: its pieces, and its islands' edges, are cut in with
                # the coast, and each piece they make is told apart below.
                edges += outers + inners
        geoms = [g for g in geoms if len(g) >= 2]
        hw = t.get("highway")
        if hw in MAJOR:
            roads["major"] += geoms
        elif hw in MINOR and (cfg["minor"] or hw != "unclassified"):
            # On the region map the village lanes (unclassified) are a mesh at that size: left out.
            roads["minor"] += geoms
        elif hw in SMALL and cfg["minor"]:
            # Footpaths only on the town maps, and only the ones a visitor walks: the beach trails.
            if hw != "path" or t.get("sac_scale") or t.get("name") or len(geoms[0]) > 6:
                roads["small"] += geoms
        elif t.get("natural") == "coastline":
            coast += geoms
        elif t.get("natural") == "water" or t.get("waterway") == "riverbank":
            water += geoms
        elif t.get("waterway") == "river" or (t.get("waterway") == "canal" and cfg["minor"]):
            rivers += geoms
        elif t.get("waterway") == "stream":
            streams += geoms

    # The sea: the coastline joined up, closed along the frame's edge, and every piece on its right
    # (OpenStreetMap draws coastlines with the land on the left) taken as sea.
    sea = Polygon()
    if coast or edges:
        lines = unary_union([LineString(c) for c in coast + edges]).intersection(frame)
        cut = list(polygonize(unary_union([lines, frame.exterior])))
        if cfg.get("water_by_roads"):
            streets = unary_union([LineString(g) for g in roads["major"] + roads["minor"]])
            def land(poly):
                inside = streets.intersection(poly.buffer(-2)).length
                return inside / max(poly.area, 1) > 0.004
            seas = [p for p in cut if not land(p)]
            cut = []
        else:
            seas = []
        segs = []
        for line in flat(unary_union([LineString(c) for c in coast])):
            for a, b in zip(line, line[1:]):
                segs.append((a, b))
        for poly in cut:
            p = poly.representative_point()
            best, side = None, 0
            for (ax, ay), (bx, by) in segs:
                dx, dy = bx - ax, by - ay
                l2 = dx * dx + dy * dy or 1e-9
                u = max(0, min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / l2))
                d = math.hypot(p.x - (ax + u * dx), p.y - (ay + u * dy))
                if best is None or d < best:
                    # y grows downwards here, so "left of the way" is a negative cross product.
                    best, side = d, (dx * (p.y - ay) - dy * (p.x - ax))
            if side > 0:
                seas.append(poly)
        sea = unary_union(seas)

    lakes = [p for p in water_polys if p.area > (6 if cfg["minor"] else 40)]
    for g in water:
        if len(g) >= 4:
            poly = Polygon(g).buffer(0)
            # On the region map only water you'd see from the hills: no village ponds.
            if poly.area > (6 if cfg["minor"] else 40):
                lakes.append(poly)
    wet = unary_union([sea] + lakes).intersection(frame.buffer(4)).simplify(tol)

    def lines(geoms, min_len=0.0):
        merged = unary_union([LineString(g) for g in geoms]) if geoms else LineString()
        clipped = merged.intersection(frame.buffer(4)).simplify(tol)
        return [c for c in flat(clipped) if LineString(c).length >= min_len]

    out = {
        "world": {"x0": round(x0), "y0": round(y0), "w": round(x1 - x0), "h": round(y1 - y0)},
        "water": path_of(rings(wet), closed=True),
        # On the region map, only the long rivers: the rest is the plain's every channel.
        "rivers": path_of(lines(rivers, 0 if cfg["minor"] else 110)),
        "streams": path_of(lines(streams, 6)) if cfg["minor"] else "",
        "major": path_of(lines(roads["major"])),
        "minor": path_of(lines(roads["minor"], 2)),
        "small": path_of(lines(roads["small"], 3)),
        "labels": [{"text": t, "x": round(proj(lng, lat)[0]), "y": round(proj(lng, lat)[1])} for t, lat, lng in cfg["labels"]],
        "places": {pid: [round(v, 1) for v in proj(spots[pid][1], spots[pid][0])] for pid in reel_places},
        **region(cfg, proj, lat0, lng0),
    }
    sizes = {k: len(v) for k, v in out.items() if isinstance(v, str)}
    print(reel, out["world"], sizes, sum(sizes.values()))
    return out


def earth(lng, lat):
    """Where a spot is on the intro's Earth, in metres from its middle, y down (onGlobe in Globe.tsx)."""
    l0, p0 = math.radians(GLOBE_CENTRE[0]), math.radians(GLOBE_CENTRE[1])
    l, p = math.radians(lng), math.radians(lat)
    x = math.cos(p) * math.sin(l - l0)
    y = math.cos(p0) * math.sin(p) - math.sin(p0) * math.cos(p) * math.cos(l - l0)
    return x * EARTH_R, -y * EARTH_R


def jacobian(f, lng, lat, e=1e-4):
    x0, y0 = f(lng, lat)
    xe, ye = f(lng + e, lat)
    xn, yn = f(lng, lat + e)
    return [[(xe - x0) / e, (xn - x0) / e], [(ye - y0) / e, (yn - y0) / e]]


def inv(a):
    d = a[0][0] * a[1][1] - a[0][1] * a[1][0]
    return [[a[1][1] / d, -a[0][1] / d], [-a[1][0] / d, a[0][0] / d]]


def mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(2)) for j in range(2)] for i in range(2)]


def region(cfg, proj, lat0, lng0):
    """The land for a few thousand kilometres around, in map units: placed as the Earth shows it,
    turned to agree with the street map at the places. Plus the matrix that turns it back to the
    Earth's way (`toEarth`), and where the dot on the Earth is (`mark`)."""
    import shapefile  # pyshp

    metres = lambda lng, lat: tuple(v * cfg["m"] for v in proj(lng, lat))
    to_map = mul(jacobian(metres, lng0, lat0), inv(jacobian(earth, lng0, lat0)))
    to_earth = inv(to_map)
    ex0, ey0 = earth(lng0, lat0)

    def place(lng, lat):
        ex, ey = earth(lng, lat)
        dx, dy = ex - ex0, ey - ey0
        return ((to_map[0][0] * dx + to_map[0][1] * dy) / cfg["m"], (to_map[1][0] * dx + to_map[1][1] * dy) / cfg["m"])

    reach = cfg["region_km"] * 1000 / cfg["m"]
    frame = box(-reach, -reach, reach, reach)
    lat_span = cfg["region_km"] / 111 + 2
    lng_span = lat_span / math.cos(math.radians(lat0))
    window = box(lng0 - lng_span, lat0 - lat_span, lng0 + lng_span, lat0 + lat_span)
    polys = []
    for shp in shapefile.Reader(str(LAND_SHP)).shapes():
        parts = list(shp.parts) + [len(shp.points)]
        for a, b in zip(parts, parts[1:]):
            ring = shp.points[a:b]
            if len(ring) < 4 or not Polygon(ring).intersects(window):
                continue
            clipped = Polygon(ring).buffer(0).intersection(window)
            for g in getattr(clipped, "geoms", [clipped]):
                if isinstance(g, Polygon) and not g.is_empty:
                    polys.append(Polygon([place(x, y) for x, y in g.exterior.coords]).buffer(0))
    # Coarse enough to stay small, fine enough for where it's seen: it is gone well before the
    # coast is a few kilometres across.
    land = unary_union(polys).intersection(frame)
    # Islands under a few square kilometres are dots by the time they'd show: left out.
    keep = unary_union([g for g in getattr(land, "geoms", [land]) if g.area > 6e6 / cfg["m"] ** 2])
    # Far out, coarse; near the place, as fine as Natural Earth goes, since that part is seen up close.
    near_r = cfg["near_km"] * 1000 / cfg["m"]
    near_box = box(-near_r, -near_r, near_r, near_r)
    far = keep.difference(near_box).simplify(900 / cfg["m"])
    close = keep.intersection(near_box.buffer(2)).simplify(60 / cfg["m"])

    # Near the place, the water OpenStreetMap knows and Natural Earth doesn't: the backwaters, and
    # the sea along the coast when the coastline came (kochi-coast.json).
    water = []
    lake_els = json.loads((DIR / "kochi-lake.json").read_text())["elements"] if (DIR / "kochi-lake.json").exists() else []
    for el in lake_els:
        if el["type"] != "relation":
            continue
        part = lambda role: [LineString([place(p["lon"], p["lat"]) for p in m["geometry"]]) for m in el["members"] if m.get("role") == role and len(m["geometry"]) >= 2]
        lake = Polygon()
        for ring in flat(linemerge(part("outer"))):
            if len(ring) >= 4 and ring[0] == ring[-1]:
                lake = lake.union(Polygon(ring).buffer(0))
        for ring in flat(linemerge(part("inner"))):
            if len(ring) >= 4 and ring[0] == ring[-1]:
                lake = lake.difference(Polygon(ring).buffer(0))
        water.append(lake)
    near_water = unary_union(water).intersection(near_box).simplify(25 / cfg["m"]) if water else Polygon()

    # The coast itself, from OpenStreetMap, inside the box it was asked for: there the land is
    # exactly what's left once the sea is taken out, in place of Natural Earth's rougher outline.
    coast_file = DIR / "kochi-coast.json"
    if coast_file.exists():
        s_, w_, n_, e_ = cfg["coast_box"]
        cbox = Polygon([place(w_, s_), place(e_, s_), place(e_, n_), place(w_, n_)])
        lines = [LineString([place(p["lon"], p["lat"]) for p in el["geometry"]]) for el in json.loads(coast_file.read_text())["elements"] if len(el.get("geometry", [])) >= 2]
        # Joined with the box's edge whole and then kept to the box: cut first, the coast's ends
        # miss the edge by a rounding hair and nothing closes.
        noded = unary_union(lines + [cbox.exterior])
        segs = [(a, b) for line in flat(unary_union(lines)) for a, b in zip(line, line[1:])]
        seas = []
        for poly in polygonize(noded):
            p = poly.representative_point()
            if not cbox.contains(p):
                continue
            best, side = None, 0
            for (ax, ay), (bx, by) in segs:
                dx, dy = bx - ax, by - ay
                l2 = dx * dx + dy * dy or 1e-9
                u = max(0, min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / l2))
                d = math.hypot(p.x - (ax + u * dx), p.y - (ay + u * dy))
                if best is None or d < best:
                    best, side = d, (dx * (p.y - ay) - dy * (p.x - ax))
            if side > 0:
                seas.append(poly)
        exact = cbox.difference(unary_union(seas))
        close = close.difference(cbox).union(exact).simplify(25 / cfg["m"])

    mark = place(cfg["mark"][1], cfg["mark"][0])
    # Written in coarser units (REGION_STEP map units each) so the numbers stay short; the near
    # part in finer ones (NEAR_STEP).
    step = lambda g, k: [[(x / k, y / k) for x, y in r] for r in rings(g)]
    region_d = path_of(step(far, REGION_STEP), closed=True)
    near_d = path_of(step(close, NEAR_STEP), closed=True)
    near_water_d = path_of(step(near_water, NEAR_STEP), closed=True)
    print("region", len(region_d), "near", len(near_d), "near water", len(near_water_d), "to_earth", to_earth)
    return {
        "region": region_d,
        "regionStep": REGION_STEP,
        "near": near_d,
        "nearWater": near_water_d,
        "nearStep": NEAR_STEP,
        "toEarth": [round(v, 5) for row in to_earth for v in row],
        "mark": [round(mark[0], 1), round(mark[1], 1)],
        "m": cfg["m"],
    }


spots, reels = places()
maps = {reel: build(reel, cfg, spots, reels[reel]) for reel, cfg in AREAS.items() if all((DIR / f"{f}.json").exists() for f in cfg["files"])}

ts = """// Made by scripts/intro-maps.py from OpenStreetMap data (© OpenStreetMap contributors, ODbL) and
// Natural Earth (public domain).
// Don't edit by hand: change the script and run it again.

/** One of the intro's street maps: SVG paths in the map's own units, each a fixed number of metres. */
export type IntroMap = {
  world: { x0: number; y0: number; w: number; h: number };
  water: string;
  rivers: string;
  streams: string;
  major: string;
  minor: string;
  small: string;
  labels: { text: string; x: number; y: number }[];
  /** Where each of the sample's places is on this map. */
  places: Record<string, [number, number]>;
  /** The land for a few thousand kilometres around (Natural Earth), for the zoom in from the Earth. */
  region: string;
  /** The region path is in units of this many map units. */
  regionStep: number;
  /** The land within a couple of hundred kilometres, finer; and the water near the place (the backwaters). */
  near: string;
  nearWater: string;
  /** The near paths are in units of this many map units. */
  nearStep: number;
  /** Turns the map's way into the Earth's ([a, b, c, d]: x' = a x + b y, y' = c x + d y). */
  toEarth: [number, number, number, number];
  /** Where the dot on the Earth is, on this map. */
  mark: [number, number];
  /** Metres in one map unit. */
  m: number;
};

export const introMaps: Record<string, IntroMap> = """ + json.dumps(maps, separators=(",", ":")) + ";\n"
dest = ROOT / "src/data/introMaps.ts"
dest.write_text(ts)
print(dest, dest.stat().st_size)
