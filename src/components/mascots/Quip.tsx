import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { skyFill, skyInk } from '@/theme/sky';
import { radii } from '@/theme/tokens';

import { KID_BODY, KID_HEAD_BOX, KidBody, kidHead } from './figures';
import { BUBBLE, BUBBLE_INK, motion } from './motion';

// The child, head and shoulders in a round badge, as a chat shows who's talking: a frame of 80
// units around the head's centre, from 40 left to 40 right and 36 above to 44 below.
const FRAME = { x: -40, y: -36, side: 80 };
const FACE = kidHead('cheer', 0);

/**
 * The child's one-liner after the stamp lands: a joke for the moment a trip is sealed. It pops in
 * just after the thud; with Reduce Motion it's simply there.
 */
export function Quip({ text, size = 56 }: { text: string; size?: number }) {
  const reduced = useReducedMotion();
  const k = size / FRAME.side;
  const at = (x: number, y: number) => ({ left: (x - FRAME.x) * k, top: (y - FRAME.y) * k });
  const head = KID_HEAD_BOX * k;
  return (
    <Animated.View style={[styles.row, !reduced && motion.popAfterStamp]}>
      <Animated.View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }, !reduced && motion.hopAfterStamp]}>
        <View style={{ position: 'absolute', ...at(KID_BODY.x, KID_BODY.y), width: KID_BODY.w * k, height: KID_BODY.h * k }}>
          <KidBody />
        </View>
        <View style={{ position: 'absolute', ...at(-KID_HEAD_BOX / 2, -KID_HEAD_BOX / 2), width: head, height: head }}>
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
