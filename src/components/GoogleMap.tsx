import type { ImageSourcePropType } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import type { LatLng } from '@/lib/geo';
import { light } from '@/theme/tokens';

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

/**
 * A Google map of places that came from Google. The web build draws it (GoogleMap.web.tsx); the
 * phone apps get theirs with a development build and the Maps SDK, which is next. Until then, say
 * so rather than put Google's places on a map that isn't Google's.
 */
export function GoogleMap({ width, height }: GoogleMapProps) {
  return (
    <View style={[styles.soon, { width, height }]}>
      <Text variant="label" color={light.inkSoft}>
        The map for this city is coming to the app soon. It’s on the web version today.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  soon: { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: light.canvasTop },
});
