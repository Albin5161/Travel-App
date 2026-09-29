import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { skyFill, skyInk } from '@/theme/sky';
import { radii } from '@/theme/tokens';

import { AMMA_BODY, AMMA_HEAD_BOX, AmmaBody, ammaHead } from './figures';
import { BUBBLE, BUBBLE_INK, motion } from './motion';

// Amma, head and shoulders in a round badge, as a chat shows who's talking: a frame of 100 units
// around her head's centre, from 50 left to 50 right and 48 above (her bun) to 52 below.
const FRAME = { x: -50, y: -48, side: 100 };
const FACE = ammaHead('cheer', 0);

/**
 * Amma's one-liner after the stamp lands: a joke for the moment a trip is sealed. It pops in just
 * after the thud; with Reduce Motion it's simply there.
 */
export function Quip({ text, size = 56 }: { text: string; size?: number }) {
  const reduced = useReducedMotion();
  const k = size / FRAME.side;
  const at = (x: number, y: number) => ({ left: (x - FRAME.x) * k, top: (y - FRAME.y) * k });
  const head = AMMA_HEAD_BOX * k;
  return (
    <Animated.View style={[styles.row, !reduced && motion.popAfterStamp]}>
      <Animated.View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }, !reduced && motion.hopAfterStamp]}>
        <View style={{ position: 'absolute', ...at(AMMA_BODY.x, AMMA_BODY.y), width: AMMA_BODY.w * k, height: AMMA_BODY.h * k }}>
          <AmmaBody arm={false} />
        </View>
        <View style={{ position: 'absolute', ...at(-AMMA_HEAD_BOX / 2, -AMMA_HEAD_BOX / 2), width: head, height: head }}>
          {FACE.base}
          {FACE.eyes}
          {FACE.mouth}
        </View>
      </Animated.View>
      <View style={styles.bubble}>
        <View style={styles.tail} />
        <Text variant="bodyStrong" color={BUBBLE_INK} maxFontSizeMultiplier={1.3}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badge: {
    overflow: 'hidden',
    backgroundColor: skyFill.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  bubble: {
    flexShrink: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.pane,
    backgroundColor: BUBBLE,
  },
  tail: {
    position: 'absolute',
    left: -5,
    top: '50%',
    marginTop: -6,
    width: 12,
    height: 12,
    backgroundColor: BUBBLE,
    transform: [{ rotate: '45deg' }],
  },
});
