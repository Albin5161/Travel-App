import { useRef } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { PhotoCard } from '@/components/PhotoCard';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { fonts, light, shadows } from '@/theme/tokens';

export type Rect = { x: number; y: number; width: number; height: number };

type FaceProps = {
  name: string;
  /** Bottom row on the photo, e.g. SPOTS · 7 */
  statLabel: string;
  statValue: string;
  badge?: string;
};

type Props = FaceProps & {
  photo: ImageSourcePropType;
  /** Two lines under the card, e.g. "Collected from" / "2 reels" */
  captionLabel: string;
  captionValue: string;
  width: number;
  /** Called with the photo's on-screen rect, so the card can grow out of exactly that spot. */
  onPress: (photoRect: Rect) => void;
  /** Hide the photo while a copy of it is growing into (or shrinking back from) the city page. */
  lifted?: boolean;
  accessibilityLabel: string;
};

export const TILE_RATIO = 1.55;
export const TILE_RADIUS = 22;

// Tall photo card for the home grid (after Atlys's country cards): name in serif caps over the
// photo, a hairline, one stat row, and a two-line caption below the card.
export function CityTile({
  name,
  photo,
  statLabel,
  statValue,
  captionLabel,
  captionValue,
  badge,
  width,
  onPress,
  lifted,
  accessibilityLabel,
}: Props) {
  const photoRef = useRef<View>(null);
  const press = () => {
    const node = photoRef.current;
    if (!node) return;
    node.measureInWindow((x, y, w, h) => onPress({ x, y, width: w, height: h }));
  };

  return (
    <PressableScale
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ width }}
    >
      <View ref={photoRef} style={[styles.shadow, lifted && styles.lifted]}>
        <PhotoCard source={photo} radius={TILE_RADIUS} style={{ width, height: width * TILE_RATIO }}>
          <CityTileFace name={name} statLabel={statLabel} statValue={statValue} badge={badge} />
        </PhotoCard>
      </View>
      <View style={styles.caption}>
        <Text variant="label" color={light.inkFaint} numberOfLines={1}>
          {captionLabel}
        </Text>
        <Text variant="label" numberOfLines={1}>
          {captionValue}
        </Text>
      </View>
    </PressableScale>
  );
}

/** What sits on the tile's photo. Also drawn on the growing card, fading out as it opens. */
export function CityTileFace({ name, statLabel, statValue, badge }: FaceProps) {
  return (
    <>
      {badge ? (
        <View style={styles.badge}>
          <Text variant="micro" color={light.photoInk} style={styles.badgeText}>
            {badge}
          </Text>
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        <View style={styles.rule} />
        <View style={styles.stat}>
          <Text variant="micro" color={light.photoInkSoft} style={styles.statText}>
            {statLabel}
          </Text>
          <Text variant="micro" color={light.photoInk} style={styles.statText}>
            {statValue}
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: TILE_RADIUS, boxShadow: shadows.card },
  lifted: { opacity: 0 },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(17,17,17,0.32)',
    borderWidth: 1,
    borderColor: light.photoLine,
  },
  badgeText: { fontSize: 9, letterSpacing: 1.5 },
  body: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  name: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: light.photoInk,
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: light.photoLine, marginTop: 18, marginBottom: 12 },
  stat: { flexDirection: 'row', justifyContent: 'space-between' },
  statText: { fontSize: 10, letterSpacing: 1.5 },
  caption: { paddingHorizontal: 4, paddingTop: 10, gap: 1 },
});
