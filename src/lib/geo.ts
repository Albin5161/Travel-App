export type LatLng = { lat: number; lng: number };
export type Point = [number, number];

export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Straight-line distance undersells real paths; 1.3 is a common detour factor.
export type TravelMode = 'walk' | 'auto' | 'cab' | 'car' | 'bus';

/** How someone gets around on a trip, as asked when planning. */
export type Getting = 'local' | 'drive' | 'bus';

export function travelLeg(a: LatLng, b: LatLng): { km: number; minutes: number; mode: TravelMode } {
  const km = distanceKm(a, b) * 1.3;
  if (km <= 2.5) return { km, minutes: Math.max(3, Math.round((km / 4.8) * 60)), mode: 'walk' };
  if (km <= 15) return { km, minutes: Math.round((km / 22) * 60) + 4, mode: 'auto' };
  return { km, minutes: Math.round((km / 35) * 60) + 5, mode: 'cab' };
}

/**
 * A leg priced for how the traveller is actually moving. Walking-and-autos is the default above.
 * Own vehicle is slower than it sounds on Kerala roads (about 30 km/h door to door, plus parking);
 * the bus adds a wait at the stop, and anything under a kilometre is walked either way.
 */
export function travelLegFor(a: LatLng, b: LatLng, getting: Getting) {
  if (getting === 'local') return travelLeg(a, b);
  const km = distanceKm(a, b) * 1.3;
  const walkable = getting === 'drive' ? 0.8 : 1.2;
  if (km <= walkable) return { km, minutes: Math.max(3, Math.round((km / 4.8) * 60)), mode: 'walk' as TravelMode };
  if (getting === 'drive') return { km, minutes: Math.round((km / 30) * 60) + 5, mode: 'car' as TravelMode };
  return { km, minutes: Math.round((km / 18) * 60) + 12, mode: 'bus' as TravelMode };
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr${h > 1 ? 's' : ''}` : `${h} hr ${m} min`;
}

export function formatClock(totalMinutes: number) {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// Catmull-Rom through the points, emitted as cubic Béziers.
export function smoothPath(pts: Point[], closed = false) {
  if (pts.length < 2) return '';
  const n = pts.length;
  const get = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return closed ? d + ' Z' : d;
}

// Length of smoothPath(pts), by sampling each Bézier segment.
export function smoothPathLength(pts: Point[]) {
  const n = pts.length;
  if (n < 2) return 0;
  const get = (i: number) => pts[Math.max(0, Math.min(n - 1, i))];
  let len = 0;
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    let prev = p1;
    for (let s = 1; s <= 24; s++) {
      const t = s / 24;
      const mt = 1 - t;
      const x = mt ** 3 * p1[0] + 3 * mt ** 2 * t * c1[0] + 3 * mt * t ** 2 * c2[0] + t ** 3 * p2[0];
      const y = mt ** 3 * p1[1] + 3 * mt ** 2 * t * c1[1] + 3 * mt * t ** 2 * c2[1] + t ** 3 * p2[1];
      len += Math.hypot(x - prev[0], y - prev[1]);
      prev = [x, y];
    }
  }
  return len;
}

export function fitCamera(points: Point[], viewW: number, viewH: number, padding = 90) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const s = Math.min(viewW / (maxX - minX + padding * 2), viewH / (maxY - minY + padding * 2));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, s: Math.max(0.2, Math.min(1.2, s)) };
}
