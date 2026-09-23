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
  /** Tile width, so the face can shrink with it. Omit for the full-size face. */
  width?: number;
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
/** Below this the serif name has to come down or it wraps to three lines. */
const COMPACT_W = 150;

/** The corner a tile of this width uses. The growing card starts here, so the hand-over matches. */
export const tileRadius = (width: number | undefined) => ((width ?? 999) < COMPACT_W ? 16 : TILE_RADIUS);

/** One scale for the whole face, so nothing drifts out of proportion as the grid narrows. */
function faceScale(width: number | undefined) {
  const compact = (width ?? 999) < COMPACT_W;
  return {
    compact,
    name: compact ? 13 : 22,
    nameLine: compact ? 15 : 24,
    nameTrack: compact ? 0.4 : 1,
    inset: compact ? 9 : 14,
    ruleTop: compact ? 10 : 18,
    ruleBottom: compact ? 7 : 12,
    stat: compact ? 8 : 10,
    statTrack: compact ? 0.8 : 1.5,
    radius: tileRadius(width),
  };
}

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
  const f = faceScale(width);
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
      <View ref={photoRef} style={[styles.shadow, { borderRadius: f.radius }, lifted && styles.lifted]}>
        <PhotoCard source={photo} radius={f.radius} style={{ width, height: width * TILE_RATIO }}>
          <CityTileFace name={name} statLabel={statLabel} statValue={statValue} badge={badge} width={width} />
        </PhotoCard>
      </View>
      <View style={[styles.caption, f.compact && styles.captionCompact]}>
        <Text variant="label" color={light.inkFaint} numberOfLines={1} style={f.compact && styles.captionText}>
          {captionLabel}
        </Text>
        <Text variant="label" numberOfLines={1} style={f.compact && styles.captionText}>
          {captionValue}
        </Text>
      </View>
    </PressableScale>
  );
}

/** What sits on the tile's photo. Also drawn on the growing card, fading out as it opens. */
export function CityTileFace({ name, statLabel, statValue, badge, width }: FaceProps) {
  const f = faceScale(width);
  return (
    <>
      {badge ? (
        <View style={[styles.badge, f.compact && styles.badgeCompact]}>
          <Text variant="micro" color={light.photoInk} style={[styles.badgeText, f.compact && styles.badgeTextCompact]}>
            {badge}
          </Text>
        </View>
      ) : null}
      <View style={[styles.body, { left: f.inset, right: f.inset, bottom: f.inset }]}>
        <Text
          style={[styles.name, { fontSize: f.name, lineHeight: f.nameLine, letterSpacing: f.nameTrack }]}
          numberOfLines={2}
        >
          {name}
        </Text>
        <View style={[styles.rule, { marginTop: f.ruleTop, marginBottom: f.ruleBottom }]} />
        <View style={styles.stat}>
          <Text variant="micro" color={light.photoInkSoft} style={[styles.statText, { fontSize: f.stat, letterSpacing: f.statTrack }]}>
            {statLabel}
          </Text>
          <Text variant="micro" color={light.photoInk} style={[styles.statText, { fontSize: f.stat, letterSpacing: f.statTrack }]}>
            {statValue}
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  shadow: { boxShadow: shadows.card },
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
  badgeCompact: { top: 7, left: 7, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText: { fontSize: 9, letterSpacing: 1.5 },
  badgeTextCompact: { fontSize: 7, letterSpacing: 0.8 },
  body: { position: 'absolute' },
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
  captionCompact: { paddingHorizontal: 2, paddingTop: 7 },
  captionText: { fontSize: 11, lineHeight: 15 },
});
