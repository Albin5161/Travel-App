import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Sky } from '@/components/sky/Sky';
import { haptic } from '@/lib/haptics';
import { useHomeSky } from '@/state/sky';
import { isLight } from '@/theme/mode';
import { fonts } from '@/theme/tokens';

// The opening screen: Albin's logo on what the app opens onto, so nothing flashes between them: on
// white for the Light look, and on the Sky look the same sky as Home, with the letters in white.
// It starts as the splash screen leaves off (the mark alone, centred, the same size), then the mark steps aside to its place in the logo while "plore"
// arrives beside it, the line under it fades up, and the whole layer fades away to reveal home.
//
// The logo is two pictures of the same size laid one over the other, the mark and the letters, so
// each can move on its own and they always meet exactly as drawn.
const MARK = require('@/assets/images/logo-mark-layer.png');
const LETTERS = require('@/assets/images/logo-letters-layer.png');
/** The logo's own proportions, and where the mark sits in it (fractions of its width and height). */
const LOGO = { w: 1106, h: 435, markW: 481 / 1106, markMidX: 240 / 1106, markMidY: 207 / 435 };
/** The mark's width on the splash screen (app.json's imageWidth), so nothing jumps between the two. */
const SPLASH_MARK = 116;
/** The logo's dark blue, for the line under it on white. */
const INK = '#0A1433';
/** On the sky: the letters and the line in white, as every word over the sky is. */
const SKY_INK = '#FFFFFF';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const HOLD = 220;
const MOVE = 560;
const LINE_AT = HOLD + 380;
const TOTAL = LINE_AT + 520;
const REST = 420;
const FADE_OUT = 350;

type Props = { onDone: () => void };

export function LaunchIntro({ onDone }: Props) {
  const { width: W } = useWindowDimensions();
  const phase = useHomeSky();
  const onSky = !isLight;
  const logoW = Math.min(SPLASH_MARK / LOGO.markW, W - 72);
  const logoH = (logoW * LOGO.h) / LOGO.w;
  // How far right the mark starts, to be in the middle of the screen as it is on the splash.
  const aside = (0.5 - LOGO.markMidX) * logoW;

  const move = useSharedValue(0);
  const line = useSharedValue(0);
  const layer = useSharedValue(1);

  useEffect(() => {
    const land = setTimeout(haptic.light, HOLD + MOVE - 120);
    move.set(withDelay(HOLD, withTiming(1, { duration: MOVE, easing: EASE })));
    line.set(withDelay(LINE_AT, withTiming(1, { duration: TOTAL - LINE_AT, easing: EASE })));
    layer.set(
      withDelay(
        TOTAL + REST,
        withTiming(0, { duration: FADE_OUT, easing: Easing.out(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(onDone);
        }),
      ),
    );
    return () => clearTimeout(land);
    // Mount-only: plays once per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - move.get()) * aside }] }));
  // The letters come in behind the mark's move, so they're never seen under it.
  const lettersStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (move.get() - 0.35) / 0.65));
    return { opacity: p, transform: [{ translateX: (1 - p) * 18 }] };
  });
  const lineStyle = useAnimatedStyle(() => ({ opacity: line.get(), transform: [{ translateY: (1 - line.get()) * 6 }] }));
  const layerStyle = useAnimatedStyle(() => ({ opacity: layer.get() }));

  return (
    <Animated.View style={[styles.layer, onSky && styles.layerSky, layerStyle]} accessibilityLabel="Xplore. Saw it in a video? Go there.">
      <StatusBar style={onSky ? 'light' : 'dark'} />
      {onSky ? <Sky phase={phase} /> : null}
      {/* Nudged so the mark's own middle, not the logo's, is on the screen's: where the splash had it. */}
      <View style={{ width: logoW, height: logoH, marginTop: (1 - 2 * LOGO.markMidY) * logoH }}>
        <Animated.View style={[StyleSheet.absoluteFill, lettersStyle]}>
          <Image source={LETTERS} style={styles.fill} contentFit="contain" transition={0} tintColor={onSky ? SKY_INK : undefined} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, markStyle]}>
          <Image source={MARK} style={styles.fill} contentFit="contain" transition={0} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.lineSlot, lineStyle]} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.line, onSky && styles.lineSky]}>Saw it in a video? Go there.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  // Under the drawn sky, in case it paints a frame late: its own night blue, never white.
  layerSky: { backgroundColor: '#13224A' },
  fill: { width: '100%', height: '100%' },
  // Out of the flow, so the logo stays centred with or without it.
  lineSlot: { position: 'absolute', left: 0, right: 0, top: '50%', marginTop: 72, alignItems: 'center' },
  // 6.9:1 on white.
  line: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 22, color: INK, opacity: 0.72 },
  lineSky: { color: SKY_INK, opacity: 0.9 },
});
