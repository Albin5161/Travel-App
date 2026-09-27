import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import { skyInk } from '@/theme/sky';

type Props = {
  /** The sky's own glass tint (SKY[phase].glass), so the card reads as the same sky, frosted. */
  tint: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

// Web draws the frost itself: expo-blur's web view caps the blur at 20px and adds its own grey,
// where a weather card wants a wider blur and the sky's colour. Phones use the system blur.
const WEB_FROST =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(28px) saturate(150%)', WebkitBackdropFilter: 'blur(28px) saturate(150%)' } as ViewStyle)
    : null;

/**
 * A frosted panel over the sky: blurred sky behind, a darker note of that sky on top, and a thin
 * light rim. Children draw in white.
 */
export function Glass({ tint, radius = 22, style, children }: Props) {
  return (
    <View style={[styles.card, { borderRadius: radius }, style]}>
      {Platform.OS === 'web' ? (
        <View style={[StyleSheet.absoluteFill, WEB_FROST, { backgroundColor: tint }]} pointerEvents="none" />
      ) : (
        <>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" />
        </>
      )}
      {children}
    </View>
  );
}

/** A card's caption: small caps and an icon, over a hairline, as a weather app heads its panels. */
export function GlassLabel({ icon, children }: { icon: React.ComponentProps<typeof Feather>['name']; children: string }) {
  return (
    <View style={styles.label}>
      <Feather name={icon} size={12} color={skyInk.faint} />
      <Text variant="micro" color={skyInk.faint}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: skyInk.line,
  },
});
