import { Icon, type IconName } from '@/components/Icon';
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import { useReduceTransparency } from '@/lib/transparency';
import { deepGlass, skyInk } from '@/theme/sky';
import { isLight } from '@/theme/mode';
import { radii, shadows } from '@/theme/tokens';

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
// where a weather card wants a wider blur and the sky's colour. iPhones use the system blur.
// Android has no blur here (expo-blur only frosts there when the content behind is wrapped in its
// own target view, and a sheet's Modal is a separate window), so a "blurred" pane was just see-
// through: the list behind read straight through the sheet. Android gets the near-solid pane.
const NO_BLUR = Platform.OS === 'android';
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
  const solid = useReduceTransparency() || (blur && NO_BLUR);
  const tint = asked ?? screen.glass;
  return (
    <View style={[styles.card, { borderRadius: radius }, style]}>
      {solid ? (
        // Reduce Transparency, or a blur Android can't draw: the same sky colour, near solid.
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
export function GlassLabel({ icon, children }: { icon: IconName; children: string }) {
  return (
    <View style={styles.label}>
      <Icon name={icon} size={12} color={skyInk.faint} />
      <Text variant="label" ink="faint" color={skyInk.faint}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // On paper a panel is white paper lifted off the page by a shadow, not a box drawn in grey.
  card: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isLight ? 'transparent' : skyInk.rim,
    boxShadow: isLight ? shadows.card : undefined,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: skyInk.line,
  },
});
