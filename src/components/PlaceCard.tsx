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
        {/* The credit sits under the pill, on its own line: beside it, a long "Experience · Nariman
            Point" and a long author name ran into each other. */}
        <View style={styles.top}>
          <GlassPill onPhoto label={typeLine(place)} />
          {place.photoCredit ? (
            <Text variant="micro" color="rgba(238,234,227,0.72)" numberOfLines={1} style={styles.credit}>
              Photo: {place.photoCredit}
            </Text>
          ) : null}
        </View>
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
  top: { position: 'absolute', top: 16, left: 16, right: 16, alignItems: 'flex-start', gap: 8 },
  credit: { marginLeft: 4, maxWidth: '100%' },
  content: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 12 },
});
