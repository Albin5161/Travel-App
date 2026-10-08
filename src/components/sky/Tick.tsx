import Feather from '@expo/vector-icons/Feather';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { DURATION, SPRING_SETTLE } from '@/lib/motion';
import { skyAccent, skyOnInk, skyInk } from '@/theme/sky';

export const TICK = 26;
const RIM = 1.5;

/**
 * The one tick on the sky: an empty ring until chosen (3:1 against any sky), then an ember disc
 * with a dark check springs in over it. Used wherever something is ticked, so choosing looks and
 * moves the same everywhere. Unticking is quicker than ticking, and Reduce Motion swaps the two.
 */
export function Tick({ on }: { on: boolean }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    if (reduced) v.set(on ? 1 : 0);
    else v.set(on ? withSpring(1, SPRING_SETTLE) : withTiming(0, { duration: DURATION.press }));
  }, [on, reduced, v]);
  const disc = useAnimatedStyle(() => ({ opacity: v.get(), transform: [{ scale: 0.6 + 0.4 * v.get() }] }));
  return (
    <View style={styles.ring}>
      <Animated.View style={[styles.disc, disc]}>
        <Feather name="check" size={14} color={skyOnInk} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: TICK,
    height: TICK,
    borderRadius: TICK / 2,
    borderWidth: RIM,
    borderColor: skyInk.outline,
  },
  // Laid over the ring, rim included, so the chosen tick is one solid disc.
  disc: {
    position: 'absolute',
    top: -RIM,
    left: -RIM,
    width: TICK,
    height: TICK,
    borderRadius: TICK / 2,
    backgroundColor: skyAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
