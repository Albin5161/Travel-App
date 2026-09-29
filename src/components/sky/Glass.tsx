import Feather from '@expo/vector-icons/Feather';
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import { useReduceTransparency } from '@/lib/transparency';
import { deepGlass, skyInk } from '@/theme/sky';
import { radii } from '@/theme/tokens';

import { useScreenSky } from './SkyScreen';

type Props = {
  /** The sky's own glass tint; defaults to the screen's sky (SkyScreen), so a card reads as the same sky, frosted. */
  tint?: string;
  radius?: number;
  /**
   * Live blur of what's behind. Only for glass over something with detail (a map, a photo, a list
   * scrolling under it): over the smooth sky a blur changes nothing you can see, and every live
   * blur is work for the phone on each frame of a scroll.
   */
  blur?: boolean;
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
 * A frosted panel over the sky: a darker note of that sky, blurred behind when asked (`blur`), and
 * a thin light rim. Children draw in white.
 */
export function Glass({ tint: asked, radius = radii.glass, blur = false, style, children }: Props) {
  const screen = useScreenSky();
  const solid = useReduceTransparency();
  const tint = asked ?? screen.glass;
  return (
    <View style={[styles.card, { borderRadius: radius }, style]}>
      {solid ? (
        // Reduce Transparency: the same sky colour, near solid, and no blur.
        <View style={[StyleSheet.absoluteFill, { backgroundColor: deepGlass(screen, 0.96) }]} pointerEvents="none" />
      ) : !blur ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" />
      ) : Platform.OS === 'web' ? (
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
