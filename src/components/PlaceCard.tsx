import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Place } from '@/data/types';
import { Tone } from '@/theme/tone';

import { GlassPill } from './GlassPill';
import { PhotoCard } from './PhotoCard';
import { MetaPills, SourceLine, typeLine } from './PlaceMeta';
import { Text } from './Text';

type Props = {
  place: Place;
  style?: StyleProp<ViewStyle>;
  overlay?: ReactNode;
};

/** The signature component: full-bleed photo, dark glass on top, content where the photo melts into Night.
 * Everything on it is drawn in the dark tone, since it sits on the photo, even in the light app. */
export function PlaceCard({ place, style, overlay }: Props) {
  return (
    <Tone value="dark">
      <PhotoCard source={place.photo} gradient="pick" style={style}>
        <GlassPill onPhoto label={typeLine(place)} style={styles.topPill} />
        <View style={styles.content}>
          <Text variant="displayXL" numberOfLines={2}>
            {place.name}
          </Text>
          <Text variant="body" color="rgba(238,234,227,0.88)">
            {place.why}
          </Text>
          <MetaPills place={place} />
          <SourceLine place={place} />
        </View>
        {overlay}
      </PhotoCard>
    </Tone>
  );
}

const styles = StyleSheet.create({
  topPill: { position: 'absolute', top: 16, left: 16 },
  content: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 12 },
});
