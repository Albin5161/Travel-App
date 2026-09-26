import { AdvancedMarker, APIProvider, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import type { LatLng } from '@/lib/geo';
import { fonts, light, shadows } from '@/theme/tokens';

import type { GoogleMapProps } from './GoogleMap';

// Places that came from Google go on a Google map; its terms don't allow them on anyone else's. The
// browser key is public by nature, so it only works on our own web addresses (restricted in Google
// Cloud to the Maps JavaScript API and our domains). A map ID lets pins be our own photo pins;
// DEMO_MAP_ID is Google's stand-in for development.
const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

export function GoogleMap({ pins, width, height, route, padding, onPinPress }: GoogleMapProps) {
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
        {pins.map((p) => (
          <AdvancedMarker
            key={p.id}
            position={p.coords}
            title={p.number ? `Stop ${p.number}, ${p.name}` : p.name}
            onClick={() => onPinPress?.(p.id)}
          >
            <PhotoPin photo={p.photo} number={p.number} />
          </AdvancedMarker>
        ))}
        {route && pins.length > 1 ? <Route path={pins.map((p) => p.coords)} /> : null}
      </Map>
    </APIProvider>
  );
}

/** The day's stops joined in order, in the app's ink. */
function Route({ path }: { path: LatLng[] }) {
  const map = useMap();
  const maps = useMapsLibrary('maps');
  // Drawn again only when the stops change, not on every render.
  const key = path.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    if (!map || !maps || !key) return;
    const points = key.split('|').map((p) => {
      const [lat, lng] = p.split(',').map(Number);
      return { lat, lng };
    });
    const line = new maps.Polyline({ map, path: points, strokeColor: light.ink, strokeOpacity: 0.85, strokeWeight: 3 });
    return () => line.setMap(null);
  }, [map, maps, key]);
  return null;
}

/** The same white-rimmed photo pin as the drawn maps, with the stop number on it for a plan. */
function PhotoPin({ photo, number }: { photo: ImageSourcePropType; number?: number }) {
  const uri = typeof photo === 'object' && photo && 'uri' in photo ? photo.uri : undefined;
  const size = number ? 34 : 40;
  return (
    <div style={{ position: 'relative', width: size, height: size, cursor: 'pointer' }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          border: `2.5px solid ${light.panel}`,
          background: light.canvasTop,
          boxShadow: shadows.pin,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {uri ? <img src={uri} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      </div>
      {number ? (
        <div
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            minWidth: 20,
            height: 20,
            padding: '0 5px',
            borderRadius: 10,
            background: light.ink,
            border: `2px solid ${light.panel}`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: fonts.sansSemi,
            fontSize: 11,
            color: light.ctaInk,
          }}
        >
          {number}
        </div>
      ) : null}
    </div>
  );
}

const styles = StyleSheet.create({
  missing: { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: light.canvasTop },
});
