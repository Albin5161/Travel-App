import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { DURATION, EASE_OUT, SPRING_SETTLE } from '@/lib/motion';
import { fonts, light, shadows } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Feather>['name'];

/**
 * Only the part of the navigator's tab-bar props this bar actually reads. Typed here rather than
 * imported from a navigation internal, so an Expo Router upgrade can't break the import path.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const ICONS: Record<string, IconName> = { index: 'bookmark', trips: 'compass', map: 'map', profile: 'user' };
const LABELS: Record<string, string> = { index: 'Home', trips: 'Trips', map: 'Map', profile: 'Profile' };

/**
 * A floating paper pill rather than a system tab bar, so it sits on the light canvas like the rest of
 * the UI. Screens pushed over the tabs (city, Pick, Plan) hide it, keeping Plan mode uninterrupted.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, i) => (
          <Tab
            key={route.key}
            name={route.name}
            focused={state.index === i}
            onPress={() => {
              if (state.index !== i) haptic.selection();
              navigation.navigate(route.name);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Tab({ name, focused, onPress }: { name: string; focused: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const on = useDerivedValue(() =>
    reduced ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, SPRING_SETTLE),
  );
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.08 * on.get() }, { translateY: -2 * on.get() }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0.55, { duration: DURATION.small, easing: EASE_OUT }),
  }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: on.get(), transform: [{ scale: on.get() }] }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={LABELS[name] ?? name}
    >
      <Animated.View style={iconStyle}>
        <Feather name={ICONS[name] ?? 'circle'} size={20} color={focused ? light.ink : light.inkFaint} />
      </Animated.View>
      <Animated.Text style={[styles.label, { color: focused ? light.ink : light.inkFaint }, labelStyle]}>
        {LABELS[name] ?? name}
      </Animated.Text>
      <Animated.View style={[styles.dot, dotStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8 },
  bar: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 30,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.card,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontFamily: fonts.sansMedium, fontSize: 11 },
  dot: { position: 'absolute', bottom: 7, width: 4, height: 4, borderRadius: 2, backgroundColor: light.ink },
});
