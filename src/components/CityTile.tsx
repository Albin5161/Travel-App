import { useRef } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

import Ionicons from '@/components/Ionicons';
import { PhotoCard } from '@/components/PhotoCard';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import type { Platform } from '@/data/types';
import { skyInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { fonts, light, shadows } from '@/theme/tokens';

export type Rect = { x: number; y: number; width: number; height: number };

type FaceProps = {
  name: string;
  /** The count under the name, e.g. "7 spots" */
  statLabel: string;
  statValue: string;
  badge?: string;
  /** Tile width, so the face can shrink with it. Omit for the full-size face. */
  width?: number;
  /** Who took a Google cover photo, credited on the photo. */
  photoCredit?: string;
};

type Props = FaceProps & {
  photo: ImageSourcePropType;
  /** Two lines under the card, e.g. "Instagram reel" / "@slowdays.kochi" */
  captionLabel: string;
  captionValue: string;
  /** Who took a Google cover photo: Google asks for the credit wherever the photo appears. */
  photoCredit?: string;
  /** Where the reels came from, shown as small logos before the caption value. */
  sources?: Platform[];
  width: number;
  /** Called with the photo's on-screen rect, so the card can grow out of exactly that spot. */
  onPress: (photoRect: Rect) => void;
  /** Hide the photo while a copy of it is growing into (or shrinking back from) the city page. */
  lifted?: boolean;
  accessibilityLabel: string;
};

export const TILE_RATIO = 1.55;
export const TILE_RADIUS = 22;
/** Below this the name has to come down or it wraps to three lines. */
const COMPACT_W = 150;

/** The corner a tile of this width uses. The growing card starts here, so the hand-over matches. */
export const tileRadius = (width: number | undefined) => ((width ?? 999) < COMPACT_W ? 16 : TILE_RADIUS);

/** One scale for the whole face, so nothing drifts out of proportion as the grid narrows. */
function faceScale(width: number | undefined) {
  const compact = (width ?? 999) < COMPACT_W;
  return {
    compact,
    name: compact ? 15 : 22,
    nameLine: compact ? 18 : 25,
    nameTrack: compact ? -0.4 : -0.7,
    inset: compact ? 9 : 14,
    stat: compact ? 11 : 13,
    radius: tileRadius(width),
  };
}

// Tall photo card for the home grid (after Atlys's country cards): name in heavy Jakarta over the
// photo, the count in words under it, and a two-line caption below the card (the source, then who made
// the videos). A Google photo's credit sits on the photo.
export function CityTile({
  name,
  photo,
  statLabel,
  statValue,
  captionLabel,
  captionValue,
  photoCredit,
  sources,
  badge,
  width,
  onPress,
  lifted,
  accessibilityLabel,
}: Props) {
  const photoRef = useRef<View>(null);
  const f = faceScale(width);
  const sky = useTone() === 'sky';
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
          <CityTileFace name={name} statLabel={statLabel} statValue={statValue} badge={badge} width={width} photoCredit={photoCredit} />
        </PhotoCard>
      </View>
      <View style={[styles.caption, f.compact && styles.captionCompact]}>
        {/* Logos ride on the short first line, so the handle underneath keeps its full width. */}
        <View style={styles.captionRow}>
          {sources?.map((p) => (
            <Ionicons
              key={p}
              name={p === 'youtube' ? 'logo-youtube' : 'logo-instagram'}
              size={f.compact ? 11 : 13}
              color={sky ? skyInk.soft : light.inkSoft}
              accessibilityLabel={p === 'youtube' ? 'YouTube' : 'Instagram'}
            />
          ))}
          <Text
            variant="label"
            color={sky ? skyInk.faint : light.inkFaint}
            numberOfLines={1}
            style={[styles.captionShrink, f.compact && styles.captionText]}
          >
            {captionLabel}
          </Text>
        </View>
        <Text variant="label" numberOfLines={1} style={f.compact && styles.captionText}>
          {captionValue}
        </Text>
      </View>
    </PressableScale>
  );
}

/** What sits on the tile's photo. Also drawn on the growing card, fading out as it opens. */
export function CityTileFace({ name, statLabel, statValue, badge, width, photoCredit }: FaceProps) {
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
        {/* The count as words under the name ("7 spots"), not a label and a figure on a ruled row. */}
        <Text variant="micro" color={light.photoInk} style={{ fontSize: f.stat, lineHeight: f.stat + 4, marginTop: f.compact ? 2 : 4 }}>
          {statValue} {statLabel.toLowerCase()}
        </Text>
        {/* Google asks for the photographer's credit wherever its photo shows: on the photo, so the
            caption below the card keeps to its two lines. */}
        {photoCredit ? (
          <Text
            variant="micro"
            color={light.photoInkSoft}
            numberOfLines={1}
            style={[styles.creditText, f.compact && styles.creditTextCompact]}
            accessibilityLabel={`Photo by ${photoCredit}`}
          >
            Photo: {photoCredit}
          </Text>
        ) : null}
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
  badgeText: { fontSize: 9, letterSpacing: 0.6 },
  badgeTextCompact: { fontSize: 7, letterSpacing: 0.4 },
  // Under the stat row, across the tile's width, over the photo's darkened foot.
  creditText: { fontSize: 9, lineHeight: 12, letterSpacing: 0.2, textTransform: 'none', marginTop: 6 },
  creditTextCompact: { fontSize: 7, lineHeight: 9, marginTop: 4 },
  body: { position: 'absolute' },
  name: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 25,
    letterSpacing: -0.7,
    color: light.photoInk,
  },
  caption: { paddingHorizontal: 4, paddingTop: 10, gap: 1 },
  captionCompact: { paddingHorizontal: 2, paddingTop: 7 },
  captionText: { fontSize: 11, lineHeight: 15 },
  // Same monochrome logos the link box swaps in, so the source reads at a glance without brand colour.
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  captionShrink: { flexShrink: 1 },
});
