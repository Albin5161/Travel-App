import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, withTiming } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { DURATION, EASE_OUT } from '@/lib/motion';
import { skyInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { light } from '@/theme/tokens';

/** The two-state split people actually see: near home, or away. Geography stops here. */
export function ScopeToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; count: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const sky = useTone() === 'sky';
  return (
    <View style={[styles.segment, sky && styles.segmentSky]}>
      {options.map((o) => (
        <Segment
          key={o.key}
          label={o.label}
          count={o.count}
          active={o.key === value}
          sky={sky}
          onPress={() => onChange(o.key)}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  count,
  active,
  sky,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  sky: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const on = useDerivedValue(() =>
    reduced ? (active ? 1 : 0) : withTiming(active ? 1 : 0, { duration: DURATION.small, easing: EASE_OUT }),
  );
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * on.get() }));
  return (
    <PressableScale
      onPress={() => {
        if (!active) haptic.selection();
        onPress();
      }}
      containerStyle={styles.segmentSlot}
      style={[styles.segmentItem, active && styles.segmentItemOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[styles.segmentInner, style]}>
        <Text variant="label" color={active || sky ? light.ctaInk : light.ink}>
          {label}
        </Text>
        <Text variant="data" color={active || sky ? 'rgba(255,255,255,0.6)' : light.inkFaint}>
          {count}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

/** Horizontal filter chips: the kind of spot, and how far you're willing to drive. */
export function Chips<T extends string | number | null>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const sky = useTone() === 'sky';
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <PressableScale
            key={String(o.key)}
            onPress={() => {
              if (!active) haptic.selection();
              onChange(o.key);
            }}
            style={[styles.chip, sky && styles.chipSky, active && (sky ? styles.chipSkyOn : styles.chipOn)]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text variant="label" color={sky ? (active ? light.ink : skyInk.soft) : active ? light.ctaInk : light.inkSoft}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 999,
    backgroundColor: light.canvas,
    borderWidth: 1,
    borderColor: light.line,
  },
  segmentSky: { backgroundColor: 'rgba(0,0,0,0.14)', borderColor: skyInk.line },
  segmentSlot: { flex: 1 },
  segmentItem: { height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segmentItemOn: { backgroundColor: light.cta },
  segmentInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.canvas,
    borderWidth: 1,
    borderColor: light.line,
  },
  chipOn: { backgroundColor: light.cta, borderColor: light.cta },
  chipSky: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: skyInk.rim },
  chipSkyOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
});
