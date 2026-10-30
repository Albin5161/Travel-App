import { APIProvider, Map, RenderingType, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Component, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { arcRoute, type LatLng } from '@/lib/geo';
import { colors, fonts, light } from '@/theme/tokens';

import type { GoogleMapPin, GoogleMapProps } from './GoogleMap';
import { PIN_SCRIPT, pinCss, type PinData } from './mapPins';

// Places that came from Google go on a Google map; its terms don't allow them on anyone else's. The
// browser key is public by nature, so it only works on our own web addresses (restricted in Google
// Cloud to the Maps JavaScript API and our domains). A map ID lets pins be our own photo pins;
// DEMO_MAP_ID is Google's stand-in for development.
const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

// When Google turns the key down (an address it isn't allowed on, like an EAS preview, or a quota
// or billing problem), it calls this global and writes its own error box into the map. Leaving that
// map in place is what hurt: in the production build, taking the screen down afterwards threw from
// inside Google's script and blanked the whole app. So the moment it fails, every map is swapped for
// a plain panel, inside a boundary that catches anything the swap itself throws.
let authFailed = false;
const failureListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  const w = window as unknown as { gm_authFailure?: () => void };
  const previous = w.gm_authFailure;
  w.gm_authFailure = () => {
    authFailed = true;
    failureListeners.forEach((l) => l());
    previous?.();
  };
}
const subscribeToFailure = (l: () => void) => {
  failureListeners.add(l);
  return () => void failureListeners.delete(l);
};
const useAuthFailed = () => useSyncExternalStore(subscribeToFailure, () => authFailed, () => false);

export function GoogleMap(props: GoogleMapProps) {
  const unavailable = <MapUnavailable width={props.width} height={props.height} />;
  return (
    <MapBoundary fallback={unavailable}>
      <GoogleMapOrPanel {...props} unavailable={unavailable} />
    </MapBoundary>
  );
}

function GoogleMapOrPanel({
  pins,
  width,
  height,
  route,
  padding,
  onPinPress,
  cards = true,
  focusId,
  you = null,
  findYou = 0,
  unavailable,
}: GoogleMapProps & { unavailable: ReactNode }) {
  const failed = useAuthFailed();
  if (failed) return unavailable;
  if (!KEY) {
    return (
      <View style={[styles.missing, { width, height }]}>
        <Text variant="label" color={light.inkSoft}>
          The map needs EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY in .env.local.
        </Text>
      </View>
    );
  }
  const pad = { top: 60, bottom: 60, left: 40, right: 40, ...padding };
  const lats = pins.map((p) => p.coords.lat);
  const lngs = pins.map((p) => p.coords.lng);
  const one = pins.length === 1 ? pins[0].coords : null;

  return (
    <APIProvider apiKey={KEY}>
      <Map
        mapId={MAP_ID}
        // Vector, so the map can tilt as it follows a plan. Where a device can't draw vector maps,
        // Google falls back to flat tiles and the glide simply stays flat.
        renderingType={RenderingType.VECTOR}
        style={{ width, height }}
        {...(one
          ? { defaultCenter: one, defaultZoom: 14 }
          : pins.length > 1
            ? {
                defaultBounds: {
                  north: Math.max(...lats),
                  south: Math.min(...lats),
                  east: Math.max(...lngs),
                  west: Math.min(...lngs),
                  padding: pad,
                },
              }
            : { defaultCenter: { lat: 20.6, lng: 78.9 }, defaultZoom: 4 })}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
      >
        <Pins pins={pins} focusId={focusId ?? null} cards={cards} padding={pad} onOpen={onPinPress} />
        <You at={you} find={findYou} padding={pad} />
        {route && pins.length > 1 ? (
          <Route path={pins.map((p) => p.coords)} reached={pins.findIndex((p) => p.id === focusId)} />
        ) : null}
        {focusId !== undefined ? <Journey pins={pins} focusId={focusId} width={width} height={height} padding={pad} /> : null}
      </Map>
    </APIProvider>
  );
}

type PinsController = {
  setPins: (pins: PinData[], focusId: string | null) => void;
  setOptions: (o: { cards?: boolean; reduced?: boolean; padding?: GoogleMapProps['padding'] }) => void;
  destroy: () => void;
};
type YouController = { set: (p: LatLng | null) => void; center: (pad: { top: number; bottom: number }) => void; destroy: () => void };
type PinsWindow = Window & {
  XplorePins?: {
    create: (o: Record<string, unknown>) => PinsController;
    me: (map: unknown, Marker: unknown, reduced: boolean) => YouController;
  };
};

// The phone page loads the fonts by their Google Fonts names; here they're the app's own.
const PIN_FONTS = {
  extraBold: [fonts.display, 'normal'],
  bold: [fonts.displayBold, 'normal'],
  regular: [fonts.sans, 'normal'],
  medium: [fonts.sansMedium, 'normal'],
  semi: [fonts.sansSemi, 'normal'],
} as const satisfies Parameters<typeof pinCss>[0];

/** Adds the shared pin script and its style to the page, once. */
function pinScript(): PinsWindow['XplorePins'] {
  const w = window as PinsWindow;
  if (!w.XplorePins) {
    const style = document.createElement('style');
    style.textContent = pinCss(PIN_FONTS);
    document.head.appendChild(style);
    const script = document.createElement('script');
    script.textContent = PIN_SCRIPT;
    document.head.appendChild(script);
  }
  return w.XplorePins;
}

/** A photo the pin can show: a web address, or a bundled picture's own. */
function photoUri(photo: GoogleMapPin['photo']): string | null {
  if (typeof photo === 'string') return photo;
  return typeof photo === 'object' && photo && 'uri' in photo && typeof photo.uri === 'string' ? photo.uri : null;
}

/** You, as a blue dot (the shared script's me()); `find` changing brings the map to you. */
function You({ at, find, padding }: { at: LatLng | null; find: number; padding: { top: number; bottom: number } }) {
  const map = useMap();
  const marker = useMapsLibrary('marker');
  const controller = useRef<YouController | null>(null);
  const found = useRef(find);

  useEffect(() => {
    if (!map || !marker) return;
    const XplorePins = pinScript();
    if (!XplorePins) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const c = XplorePins.me(map, marker.AdvancedMarkerElement, reduced);
    controller.current = c;
    return () => {
      c.destroy();
      controller.current = null;
    };
  }, [map, marker]);

  useEffect(() => {
    controller.current?.set(at);
  }, [at?.lat, at?.lng, map, marker]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (find === found.current) return;
    found.current = find;
    controller.current?.center(padding);
  }, [find]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/**
 * The photo pins, drawn by the script the phone map runs too (mapPins.ts): they grow with the zoom
 * and a tap grows the place's card out of its pin.
 */
function Pins({
  pins,
  focusId,
  cards,
  padding,
  onOpen,
}: {
  pins: GoogleMapPin[];
  focusId: string | null;
  cards: boolean;
  padding: { top: number; bottom: number; left: number; right: number };
  onOpen?: (id: string) => void;
}) {
  const map = useMap();
  const marker = useMapsLibrary('marker');
  const controller = useRef<PinsController | null>(null);
  // The latest handler, so a new one never means taking the pins down and drawing them again.
  const open = useRef(onOpen);
  useEffect(() => {
    open.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    if (!map || !marker) return;
    const XplorePins = pinScript();
    if (!XplorePins) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const c = XplorePins.create({ map, Marker: marker.AdvancedMarkerElement, cards, reduced, padding, onOpen: (id: string) => open.current?.(id) });
    controller.current = c;
    return () => {
      c.destroy();
      controller.current = null;
    };
    // Made once per map; later changes go through setOptions and setPins below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, marker]);

  useEffect(() => {
    controller.current?.setOptions({ cards, padding });
  }, [cards, padding.top, padding.bottom, padding.left, padding.right]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    controller.current?.setPins(
      pins.map((p) => ({ id: p.id, name: p.name, lat: p.coords.lat, lng: p.coords.lng, photo: photoUri(p.photo), number: p.number, been: p.been, card: p.card })),
      focusId,
    );
  }, [pins, focusId, map, marker]);

  return null;
}

/** Anything thrown by the map or by taking it down stays here, instead of blanking the app. */
class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** In the map's place when Google won't draw it. The places and the plan below work the same. */
function MapUnavailable({ width, height }: { width: number; height: number }) {
  return (
    <View style={[styles.missing, { width, height }]}>
      <Text variant="label" color={light.inkSoft} style={styles.missingText}>
        The map couldn’t load here. Your places and plan still work.
      </Text>
    </View>
  );
}

/**
 * The day's stops joined in order by a dotted trail of gentle arcs, in the app's ink; the way so
 * far, up to `reached`, drawn over it as a solid ember line. The trail fills in as the plan is read.
 */
function Route({ path, reached = -1 }: { path: LatLng[]; reached?: number }) {
  const map = useMap();
  const maps = useMapsLibrary('maps');
  const core = useMapsLibrary('core');
  // Drawn again only when the stops change, not on every render.
  const key = path.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    if (!map || !maps || !core || !key) return;
    const dot = { path: core.SymbolPath.CIRCLE, scale: 2.2, fillColor: light.ink, fillOpacity: 0.9, strokeOpacity: 0 };
    const line = new maps.Polyline({ map, path: arcRoute(parsePath(key)).points, strokeOpacity: 0, icons: [{ icon: dot, offset: '0', repeat: '9px' }] });
    return () => line.setMap(null);
  }, [map, maps, core, key]);
  useEffect(() => {
    if (!map || !maps || !key || reached < 1) return;
    const arc = arcRoute(parsePath(key));
    const line = new maps.Polyline({
      map,
      path: arc.points.slice(0, arc.at[reached] + 1),
      strokeColor: colors.ember,
      strokeOpacity: 1,
      strokeWeight: 4,
      zIndex: 1,
    });
    return () => line.setMap(null);
  }, [map, maps, key, reached]);
  return null;
}

const parsePath = (key: string) =>
  key.split('|').map((p) => {
    const [lat, lng] = p.split(',').map(Number);
    return { lat, lng };
  });

// The camera, in Google's world coordinates (0–1 across the whole Earth), so a glide between two
// stops is a straight line on the map and the zoom can be worked out for any pair of places.
type Cam = { x: number; y: number; zoom: number; tilt: number; heading: number };
const TILE = 256;
// On a stop the map leans well over and turns a little, so streets run on the diagonal and the
// buildings stand up as blocks (Google raises them from zoom 17). The whole-day view stays flat
// and north up.
const JOURNEY_TILT = 55;
const JOURNEY_HEADING = 25;
const STOP_ZOOM = { min: 17, max: 17.6 };
const toWorld = ({ lat, lng }: LatLng) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: (lng + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) };
};
const fromWorld = (x: number, y: number) => ({
  lng: x * 360 - 180,
  lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
});
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Follows the plan as it's scrolled: the whole day flat at the top, then tilted and close on each
 * stop in turn. Close stops slide over; far ones lift off to keep both ends in sight, then land.
 */
function Journey({
  pins,
  focusId,
  width,
  height,
  padding,
}: {
  pins: GoogleMapProps['pins'];
  focusId: string | null;
  width: number;
  height: number;
  padding: { top: number; bottom: number; left: number; right: number };
}) {
  const map = useMap();
  const frame = useRef(0);
  const key = pins.map((p) => `${p.id}@${p.coords.lat},${p.coords.lng}`).join('|');

  useEffect(() => {
    if (!map || pins.length === 0) return;
    const availW = Math.max(80, width - padding.left - padding.right);
    const availH = Math.max(80, height - padding.top - padding.bottom);
    // Below the view's centre by this much is the middle of the part no panel covers.
    const offX = (padding.left - padding.right) / 2;
    const offY = (padding.top - padding.bottom) / 2;

    const pts = pins.map((p) => toWorld(p.coords));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    // The zoom that fits the whole day in the uncovered part; one stop alone gets a street's view.
    // Stops close together get closer in (up to 17), so their photo pins don't sit on each other:
    // capped at 15, four stops 300 m apart were one heap.
    const fitZoom = clamp(
      Math.min(
        Math.log2(availW / (Math.max(Math.max(...xs) - Math.min(...xs), 1e-7) * TILE)),
        Math.log2(availH / (Math.max(Math.max(...ys) - Math.min(...ys), 1e-7) * TILE)),
      ),
      3,
      pins.length > 1 ? 17 : 15,
    );
    const scale = (z: number) => TILE * 2 ** z;

    const i = pins.findIndex((p) => p.id === focusId);
    let target: Cam;
    if (i < 0) {
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      target = { x: cx - offX / scale(fitZoom), y: cy - offY / scale(fitZoom), zoom: fitZoom, tilt: 0, heading: 0 };
    } else {
      const zoom = clamp(fitZoom + 3, STOP_ZOOM.min, STOP_ZOOM.max);
      // Tilted, ground near the centre is stretched about 1/cos(tilt) up the screen.
      const lift = offY / Math.cos((JOURNEY_TILT * Math.PI) / 180);
      // Turned, the screen's right and down no longer run east and south: the offset turns with it.
      const h = (JOURNEY_HEADING * Math.PI) / 180;
      target = {
        x: pts[i].x - (offX * Math.cos(h) - lift * Math.sin(h)) / scale(zoom),
        y: pts[i].y - (offX * Math.sin(h) + lift * Math.cos(h)) / scale(zoom),
        zoom,
        tilt: JOURNEY_TILT,
        heading: JOURNEY_HEADING,
      };
    }

    const center = map.getCenter();
    const from: Cam | null = center
      ? { ...toWorld({ lat: center.lat(), lng: center.lng() }), zoom: map.getZoom() ?? target.zoom, tilt: map.getTilt() ?? 0, heading: map.getHeading() ?? 0 }
      : null;
    const put = (c: Cam) => map.moveCamera({ center: fromWorld(c.x, c.y), zoom: c.zoom, tilt: c.tilt, heading: c.heading });

    cancelAnimationFrame(frame.current);
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!from || reduced) {
      put(target);
      return;
    }
    // How far out to lift so both ends fit on screen partway, if the hop needs it.
    const hop = Math.hypot(target.x - from.x, target.y - from.y);
    const bothFit = hop > 0 ? Math.log2((0.8 * Math.min(availW, availH)) / (hop * TILE)) : Infinity;
    const straight = (from.zoom + target.zoom) / 2;
    const dip = Math.max(0, straight - Math.min(bothFit, straight));
    const duration = clamp(650 + dip * 160 + Math.abs(target.zoom - from.zoom) * 60, 650, 1700);
    const start = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / duration);
      const e = easeInOut(u);
      put({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        zoom: from.zoom + (target.zoom - from.zoom) * e - dip * Math.sin(Math.PI * u),
        tilt: from.tilt + (target.tilt - from.tilt) * e,
        heading: from.heading + (target.heading - from.heading) * e,
      });
      if (u < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    // A finger on the map takes over from the glide.
    const stop = map.addListener('dragstart', () => cancelAnimationFrame(frame.current));
    return () => {
      stop.remove();
      cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, focusId, width, height, padding.top, padding.bottom, padding.left, padding.right]);

  return null;
}

const styles = StyleSheet.create({
  missing: { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: light.canvasTop },
  missingText: { textAlign: 'center', maxWidth: 260 },
});
