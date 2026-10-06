import { useEffect, useMemo, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Text } from '@/components/Text';
import { arcRoute, type LatLng } from '@/lib/geo';
import { PLAN_LINK_BASE } from '@/lib/share';
import { light } from '@/theme/tokens';

import { googleMapPage, type MapPageMessage, type MapPageState } from './googleMapPage';

export type GoogleMapPin = {
  id: string;
  name: string;
  coords: LatLng;
  photo: ImageSourcePropType;
  /** The stop's place in the day, shown on the pin. */
  number?: number;
  /** Somewhere you've already been: the pin goes grey, with a tick. */
  been?: boolean;
};

export type GoogleMapProps = {
  pins: GoogleMapPin[];
  width: number;
  height: number;
  /** Join the pins in order: the day's route. */
  route?: boolean;
  /** Room kept clear around the pins, for panels that sit over the map. */
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
  onPinPress?: (id: string) => void;
  /**
   * The stop the plan is on, as someone scrolls it. The map tilts and glides to it, and the route
   * so far lights up; null goes back to the whole day, flat.
   */
  focusId?: string | null;
};

// Places that came from Google go on a Google map; its terms don't allow them on anyone else's
// (so not Apple's, which is the only native map Expo Go has on an iPhone). The phone apps show the
// same Google map the website does, in a web view: one page (googleMapPage.ts) drawn by Google's
// own script. It works in Expo Go and needs no key of its own.
//
// The browser key only works on our own web addresses, so the page is given the site's address as
// its own. Nothing is loaded from there; it's what Google checks the key against.
const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';
const PAGE = KEY ? { html: googleMapPage(KEY, MAP_ID), baseUrl: `${PLAN_LINK_BASE}/` } : null;

/** A photo the page can load: a web address. Bundled pictures have none, so those pins go plain. */
function photoUri(photo: ImageSourcePropType): string | null {
  const uri = typeof photo === 'object' && photo && 'uri' in photo ? photo.uri : undefined;
  return uri && uri.startsWith('https://') ? uri : null;
}

export function GoogleMap({ pins, width, height, route, padding, onPinPress, focusId }: GoogleMapProps) {
  const web = useRef<WebView>(null);
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const pad = { top: 60, bottom: 60, left: 40, right: 40, ...padding };
  // As text, so the page is told only when something it draws has actually changed.
  const state = useMemo(() => {
    const arc = route && pins.length > 1 ? arcRoute(pins.map((p) => p.coords)) : null;
    return JSON.stringify({
      pins: pins.map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.coords.lat,
        lng: p.coords.lng,
        photo: photoUri(p.photo),
        number: p.number,
        been: p.been,
      })),
      route: !!route,
      ...(arc ? { line: arc.points, lineAt: arc.at } : {}),
      padding: pad,
      focusId,
      width,
      height,
      reduced,
    } satisfies MapPageState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, route, pad.top, pad.bottom, pad.left, pad.right, focusId, width, height, reduced]);

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.apply(${state}); true;`);
  }, [ready, state]);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: MapPageMessage;
    try {
      m = JSON.parse(e.nativeEvent.data) as MapPageMessage;
    } catch {
      return;
    }
    if (m.type === 'ready') setReady(true);
    else if (m.type === 'failed') setFailed(true);
    else if (m.type === 'pin') onPinPress?.(m.id);
  };

  if (!PAGE || failed) {
    return (
      <View style={[styles.missing, { width, height }]}>
        <Text variant="label" color={light.inkSoft} style={styles.missingText}>
          {PAGE ? 'The map couldn’t load here. Your places and plan still work.' : 'The map needs EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY in .env.local.'}
        </Text>
      </View>
    );
  }

  return (
    <WebView
      ref={web}
      source={PAGE}
      originWhitelist={['*']}
      style={[styles.map, { width, height }]}
      onMessage={onMessage}
      onError={() => setFailed(true)}
      // The page is the map and nothing else: it never scrolls, bounces or zooms as a page.
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      // Tapping a link on the map (Google's terms, a place) mustn't replace the map with a website.
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(req) => req.url.startsWith(PAGE.baseUrl) || req.url === 'about:blank'}
      accessibilityLabel="Map of your places"
    />
  );
}

const styles = StyleSheet.create({
  map: { backgroundColor: light.canvasTop },
  missing: { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: light.canvasTop },
  missingText: { textAlign: 'center', maxWidth: 260 },
});
