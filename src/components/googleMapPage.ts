import { colors, light } from '@/theme/tokens';

import { PIN_SCRIPT, pinCss, type PinData, type PinFonts } from './mapPins';

// The page the phone apps show their Google map in (GoogleMap.tsx puts it in a web view). It draws
// what GoogleMap.web.tsx draws, with Google's own script instead of React: the day's route, and the
// camera that tilts and glides from stop to stop. Change one, change the other. The pins and their
// cards are one shared script (mapPins.ts) that both maps run.
//
// The app talks to it by calling `apply(state)`; it answers with messages: ready, failed, and pin
// (open that place).

/** What the app sends each time something about the map changes. */
export type MapPageState = {
  pins: PinData[];
  route: boolean;
  /** Pins grow their place's card when tapped; without, a tap opens the place. */
  cards: boolean;
  /** The route as drawn: arcs between the stops (lib/geo arcRoute), and where each stop sits along them. */
  line?: { lat: number; lng: number }[];
  lineAt?: number[];
  padding: { top: number; bottom: number; left: number; right: number };
  /** Undefined: a plain map. Null: the whole day, flat. An id: tilted and close on that stop. */
  focusId?: string | null;
  width: number;
  height: number;
  reduced: boolean;
};

export type MapPageMessage = { type: 'ready' } | { type: 'failed' } | { type: 'pin'; id: string };

// The page loads the app's two fonts from Google Fonts: it has no way to reach the app's own files.
const FONTS: PinFonts = {
  extraBold: ["'Plus Jakarta Sans'", '800'],
  bold: ["'Plus Jakarta Sans'", '700'],
  regular: ['Geist', '400'],
  medium: ['Geist', '500'],
  semi: ['Geist', '600'],
};

export function googleMapPage(key: string, mapId: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Plus+Jakarta+Sans:wght@700;800&display=swap">
<style>
${pinCss(FONTS)}
  html, body, #map { height: 100%; margin: 0; background: ${light.canvasTop}; }
  body { -webkit-user-select: none; -webkit-touch-callout: none; overflow: hidden; }
</style>
</head>
<body>
<div id="map"></div>
<script>${PIN_SCRIPT}</script>
<script>
(function () {
  var post = function (m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  // Google turns the key down by calling this; the app then shows its plain panel instead.
  window.gm_authFailure = function () { post({ type: 'failed' }); };

  var map = null, Marker = null, pins = null, pending = null, state = null;
  var baseLine = null, reachedLine = null, frame = 0, dragStop = null;

  var TILE = 256, JOURNEY_TILT = 55, JOURNEY_HEADING = 25;
  var toWorld = function (p) { var s = Math.sin(p.lat * Math.PI / 180); return { x: (p.lng + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) }; };
  var fromWorld = function (x, y) { return { lng: x * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI }; };
  var easeInOut = function (u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  // The day's stops joined in order by a dotted trail of arcs, in the app's ink; the way so far, up
  // to the stop in focus, as a solid ember line over it.
  function drawRoute(s) {
    if (baseLine) { baseLine.setMap(null); baseLine = null; }
    if (reachedLine) { reachedLine.setMap(null); reachedLine = null; }
    if (!s.route || s.pins.length < 2) return;
    var path = s.line || s.pins.map(function (p) { return { lat: p.lat, lng: p.lng }; });
    var dot = { path: google.maps.SymbolPath.CIRCLE, scale: 2.2, fillColor: '${light.ink}', fillOpacity: 0.9, strokeOpacity: 0 };
    baseLine = new google.maps.Polyline({ map: map, path: path, strokeOpacity: 0, icons: [{ icon: dot, offset: '0', repeat: '9px' }] });
    var reached = s.pins.findIndex(function (p) { return p.id === s.focusId; });
    var upTo = s.lineAt ? s.lineAt[reached] : reached;
    if (reached >= 1) reachedLine = new google.maps.Polyline({ map: map, path: path.slice(0, upTo + 1), strokeColor: '${colors.ember}', strokeOpacity: 1, strokeWeight: 4, zIndex: 1 });
  }

  // Follows the plan as it's scrolled: the whole day flat at the top, then tilted and close on each
  // stop in turn. Close stops slide over; far ones lift off to keep both ends in sight, then land.
  function journey(s) {
    cancelAnimationFrame(frame);
    if (dragStop) { dragStop.remove(); dragStop = null; }
    if (s.focusId === undefined || s.pins.length === 0) return;
    var pad = s.padding;
    var availW = Math.max(80, s.width - pad.left - pad.right);
    var availH = Math.max(80, s.height - pad.top - pad.bottom);
    var offX = (pad.left - pad.right) / 2, offY = (pad.top - pad.bottom) / 2;
    var pts = s.pins.map(toWorld);
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var fitZoom = clamp(Math.min(Math.log2(availW / (Math.max(maxX - minX, 1e-7) * TILE)), Math.log2(availH / (Math.max(maxY - minY, 1e-7) * TILE))), 3, s.pins.length > 1 ? 17 : 15);
    var scale = function (z) { return TILE * Math.pow(2, z); };
    var i = s.pins.findIndex(function (p) { return p.id === s.focusId; });
    var target;
    if (i < 0) {
      target = { x: (minX + maxX) / 2 - offX / scale(fitZoom), y: (minY + maxY) / 2 - offY / scale(fitZoom), zoom: fitZoom, tilt: 0, heading: 0 };
    } else {
      var zoom = clamp(fitZoom + 3, 17, 17.6);
      var lift = offY / Math.cos(JOURNEY_TILT * Math.PI / 180);
      var h = JOURNEY_HEADING * Math.PI / 180;
      target = { x: pts[i].x - (offX * Math.cos(h) - lift * Math.sin(h)) / scale(zoom), y: pts[i].y - (offX * Math.sin(h) + lift * Math.cos(h)) / scale(zoom), zoom: zoom, tilt: JOURNEY_TILT, heading: JOURNEY_HEADING };
    }
    var put = function (c) { map.moveCamera({ center: fromWorld(c.x, c.y), zoom: c.zoom, tilt: c.tilt, heading: c.heading }); };
    var center = map.getCenter();
    var from = center ? { x: toWorld({ lat: center.lat(), lng: center.lng() }).x, y: toWorld({ lat: center.lat(), lng: center.lng() }).y, zoom: map.getZoom() || target.zoom, tilt: map.getTilt() || 0, heading: map.getHeading() || 0 } : null;
    if (!from || s.reduced) { put(target); return; }
    var hop = Math.hypot(target.x - from.x, target.y - from.y);
    var bothFit = hop > 0 ? Math.log2((0.8 * Math.min(availW, availH)) / (hop * TILE)) : Infinity;
    var straight = (from.zoom + target.zoom) / 2;
    var dip = Math.max(0, straight - Math.min(bothFit, straight));
    var duration = clamp(650 + dip * 160 + Math.abs(target.zoom - from.zoom) * 60, 650, 1700);
    var start = performance.now();
    var step = function (now) {
      var u = Math.min(1, (now - start) / duration), e = easeInOut(u);
      put({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, zoom: from.zoom + (target.zoom - from.zoom) * e - dip * Math.sin(Math.PI * u), tilt: from.tilt + (target.tilt - from.tilt) * e, heading: from.heading + (target.heading - from.heading) * e });
      if (u < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // A finger on the map takes over from the glide.
    dragStop = map.addListener('dragstart', function () { cancelAnimationFrame(frame); });
  }

  // Where the map opens: one place at street level, several fitted with room for the panels, none
  // looking at all of India.
  function open(s) {
    var options = { mapId: '${mapId}', renderingType: 'VECTOR', gestureHandling: 'greedy', disableDefaultUI: true, clickableIcons: false, keyboardShortcuts: false };
    if (s.pins.length === 1) { options.center = { lat: s.pins[0].lat, lng: s.pins[0].lng }; options.zoom = 14; }
    else if (s.pins.length === 0) { options.center = { lat: 20.6, lng: 78.9 }; options.zoom = 4; }
    map = new google.maps.Map(document.getElementById('map'), options);
    if (s.pins.length > 1) {
      var b = new google.maps.LatLngBounds();
      s.pins.forEach(function (p) { b.extend({ lat: p.lat, lng: p.lng }); });
      map.fitBounds(b, s.padding);
    }
  }

  var journeyKey = '';
  window.apply = function (s) {
    if (!Marker) { pending = s; return; }
    if (!map) {
      open(s);
      pins = window.XplorePins.create({ map: map, Marker: Marker, cards: s.cards, reduced: s.reduced, padding: s.padding, onOpen: function (id) { post({ type: 'pin', id: id }); } });
    }
    state = s;
    pins.setOptions({ cards: s.cards, reduced: s.reduced, padding: s.padding });
    pins.setPins(s.pins, s.focusId);
    drawRoute(s);
    // The camera moves only when the stops, the stop in focus or the room around them change.
    var key = JSON.stringify([s.pins.map(function (p) { return [p.id, p.lat, p.lng]; }), s.focusId === undefined ? 'none' : s.focusId, s.width, s.height, s.padding]);
    if (key !== journeyKey) { journeyKey = key; journey(s); }
  };

  window.init = function () {
    Promise.all([google.maps.importLibrary('maps'), google.maps.importLibrary('marker')]).then(function (libs) {
      Marker = libs[1].AdvancedMarkerElement;
      post({ type: 'ready' });
      if (pending) { var s = pending; pending = null; window.apply(s); }
    }).catch(function () { post({ type: 'failed' }); });
  };
})();
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=init" onerror="window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failed' }))"></script>
</body>
</html>`;
}
