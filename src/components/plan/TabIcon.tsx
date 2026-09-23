import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { light } from '@/theme/tokens';

export type TabIconName = 'overview' | 'places' | 'plan' | 'safety';

const GLYPH: Record<TabIconName, React.ComponentProps<typeof Feather>['name']> = {
  overview: 'book-open',
  places: 'map-pin',
  plan: 'calendar',
  safety: 'shield',
};

// Enough overshoot to read as a gesture, not enough to wobble.
const POP = { duration: 480, dampingRatio: 0.58 } as const;
const SETTLE = { duration: 380, dampingRatio: 1 } as const;

type Props = { name: TabIconName; active: boolean; size?: number };

/**
 * The active tab's icon performs the thing it depicts: the book opens, the pin drops, the calendar
 * ticks over, the shield sends out one ring. Each is a single spring on transform and opacity, so
 * four of them cost nothing — and because the motion differs per tab, the change of section is
 * legible from the corner of your eye without an underline.
 */
export function TabIcon({ name, active, size = 19 }: Props) {
  const reduced = useReducedMotion();
  // Drives the resting difference between active and inactive.
  const on = useDerivedValue(() => (reduced ? (active ? 1 : 0) : withSpring(active ? 1 : 0, SETTLE)));
  // Fires once per activation, for the part that is a gesture rather than a state.
  const kick = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) return;
    kick.set(0);
    kick.set(withSpring(1, POP));
  }, [active, kick, reduced]);

  const glyphStyle = useAnimatedStyle(() => {
    const k = kick.get();
    const lift = on.get();
    switch (name) {
      // The book opens: the spine stays, the pages widen.
      case 'overview':
        return { transform: [{ scaleX: 0.78 + 0.22 * k }, { scale: 1 + 0.06 * lift }] };
      // The pin drops in and lands.
      case 'places':
        return { transform: [{ translateY: -9 * (1 - k) }, { scale: 1 + 0.06 * lift }] };
      // The day turns over.
      case 'plan':
        return { transform: [{ rotate: `${-14 * (1 - k)}deg` }, { scale: (0.88 + 0.12 * k) * (1 + 0.06 * lift) }] };
      // The shield just holds; its ring does the talking.
      case 'safety':
      default:
        return { transform: [{ scale: (0.9 + 0.1 * k) * (1 + 0.06 * lift) }] };
    }
  });

  const colourStyle = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * on.get() }));

  return (
    <View style={[styles.slot, { width: size + 12, height: size + 12 }]}>
      {name === 'safety' ? <Ring active={active} reduced={reduced} size={size + 12} /> : null}
      <Animated.View style={colourStyle}>
        <Animated.View style={glyphStyle}>
          <Feather name={GLYPH[name]} size={size} color={active ? light.ink : light.inkFaint} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** One ring out from the shield when Good to know becomes the section you're in. */
function Ring({ active, reduced, size }: { active: boolean; reduced: boolean; size: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) return;
    t.set(0);
    t.set(withTiming(1, { duration: 720, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
  }, [active, reduced, t]);

  const style = useAnimatedStyle(() => {
    const v = t.get();
    return {
      opacity: v === 0 || v === 1 ? 0 : 0.42 * (1 - v),
      transform: [{ scale: 0.55 + v * 0.85 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: light.ink },
});
