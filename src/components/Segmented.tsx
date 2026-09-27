import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { SPRING_SHEET } from '@/lib/motion';
import { skyFill, skyInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { light, shadows } from '@/theme/tokens';

type Option<K extends string> = { key: K; label: string; count?: number };

type Props<K extends string> = {
  value: K;
  options: Option<K>[];
  onChange: (key: K) => void;
};

const H = 40;
const PAD = 3;
const BORDER = 1;

/**
 * Two (or more) halves of one list. A white thumb slides under the active label on a slightly
 * springy curve, so the switch feels like moving a physical tab rather than repainting a button.
 */
export function Segmented<K extends string>({ value, options, onChange }: Props<K>) {
  const reduced = useReducedMotion();
  const sky = useTone() === 'sky';
  const [width, setWidth] = useState(0);
  // onLayout reports the outer width; the thumb lives inside the border and the padding.
  const seg = width > 0 ? (width - PAD * 2 - BORDER * 2) / options.length : 0;
  const active = Math.max(0, options.findIndex((o) => o.key === value));
  const x = useSharedValue(0);

  // The first measurement places the thumb; only later changes of tab animate it.
  const placed = useRef(false);
  useEffect(() => {
    if (seg === 0) return;
    const to = active * seg;
    x.set(reduced || !placed.current ? to : withSpring(to, SPRING_SHEET));
    placed.current = true;
  }, [active, reduced, seg, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View style={[styles.track, sky && styles.trackSky]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {seg > 0 ? <Animated.View style={[styles.thumb, sky && styles.thumbSky, { width: seg }, thumb]} /> : null}
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={styles.option}
            hitSlop={{ top: PAD, bottom: PAD }}
            onPress={() => {
              if (on) return;
              haptic.selection();
              onChange(o.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.count != null ? `${o.label}, ${o.count}` : o.label}
          >
            <Text variant="label" color={sky ? (on ? skyInk.strong : skyInk.faint) : on ? light.ink : light.inkSoft}>
              {o.label}
            </Text>
            {o.count != null ? (
              <Text variant="data" color={sky ? skyInk.faint : on ? light.inkSoft : light.inkFaint}>
                {o.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: H,
    padding: PAD,
    borderRadius: H / 2,
    backgroundColor: light.canvas,
    borderWidth: BORDER,
    borderColor: light.line,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    bottom: PAD,
    borderRadius: (H - PAD * 2) / 2,
    backgroundColor: light.panel,
    boxShadow: shadows.button,
  },
  // Over the sky: a darker well with a lighter pane sliding in it, like the system control on glass.
  trackSky: { backgroundColor: skyFill.well, borderColor: skyInk.line },
  thumbSky: { backgroundColor: skyFill.pressed, boxShadow: 'none' },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
