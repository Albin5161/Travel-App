import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icon3D, type Story } from '@/components/Icon3D';
import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { SPRING_SHEET } from '@/lib/motion';
import { isLight } from '@/theme/mode';
import { skyFill, skyInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { light, shadows } from '@/theme/tokens';

/** `icon`: a small 3D picture beside the name (a bundled asset), with the `story` it plays on a tap. */
type Option<K extends string> = { key: K; label: string; count?: number; icon?: number; story?: Story };

type Props<K extends string> = {
  value: K;
  options: Option<K>[];
  onChange: (key: K) => void;
};

const H = 40;
/** Taller when the halves carry pictures, so a 26pt icon sits in the thumb with room round it. */
const H_ICONS = 46;
const ICON = 26;
const PAD = 3;
const BORDER = 1;

/**
 * Two (or more) halves of one list. A white thumb slides under the active label on a slightly
 * springy curve, so the switch feels like moving a physical tab rather than repainting a button.
 * With pictures (Home's Near Home and Cities, after Airbnb's 3D tab icons), the one under your
 * finger squashes, and on a tap it hops, wobbles and plays its story (components/Icon3D).
 */
export function Segmented<K extends string>({ value, options, onChange }: Props<K>) {
  const reduced = useReducedMotion();
  const sky = useTone() === 'sky';
  const [width, setWidth] = useState(0);
  const h = options.some((o) => o.icon != null) ? H_ICONS : H;
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
    <View
      style={[styles.track, { height: h, borderRadius: h / 2 }, sky && styles.trackSky]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {seg > 0 ? <Animated.View style={[styles.thumb, { width: seg, borderRadius: (h - PAD * 2) / 2 }, sky && styles.thumbSky, thumb]} /> : null}
      {options.map((o) => (
        <Half key={o.key} option={o} on={o.key === value} sky={sky} onChange={onChange} />
      ))}
    </View>
  );
}

function Half<K extends string>({
  option: o,
  on,
  sky,
  onChange,
}: {
  option: Option<K>;
  on: boolean;
  sky: boolean;
  onChange: (key: K) => void;
}) {
  const [held, setHeld] = useState(false);
  const [played, setPlayed] = useState(0);

  return (
    <Pressable
      style={styles.option}
      hitSlop={{ top: PAD, bottom: PAD }}
      onPressIn={() => setHeld(true)}
      onPressOut={() => setHeld(false)}
      onPress={() => {
        setPlayed((n) => n + 1);
        if (on) return;
        haptic.selection();
        onChange(o.key);
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={o.count != null ? `${o.label}, ${o.count}` : o.label}
    >
      {o.icon != null ? <Icon3D source={o.icon} size={ICON} story={o.story} pressed={held} played={played} style={!on && styles.iconOff} /> : null}
      {/* One line, whatever the count: the count sits close after its label, and on a narrow phone
          with a long label and a three-figure count the label gives way with "…" instead of wrapping. */}
      <View style={styles.words}>
        <Text variant="label" numberOfLines={1} style={styles.label} color={sky ? (on ? skyInk.strong : skyInk.faint) : on ? light.ink : light.inkSoft}>
          {o.label}
        </Text>
        {o.count != null ? (
          <Text variant="label" ink="soft" tabular numberOfLines={1} color={sky ? skyInk.faint : on ? light.inkSoft : light.inkFaint}>
            {o.count}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: PAD,
    backgroundColor: light.canvas,
    borderWidth: BORDER,
    borderColor: light.line,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    bottom: PAD,
    backgroundColor: light.panel,
    boxShadow: shadows.button,
  },
  // Over the sky: a darker well with a lighter pane sliding in it, like the system control on glass.
  trackSky: { backgroundColor: skyFill.well, borderColor: skyInk.line },
  // In the light look the well and the pressed grey are one colour, and the pane vanished into it:
  // there it is the white pane with its small shadow.
  thumbSky: isLight ? { backgroundColor: light.panel, boxShadow: shadows.button } : { backgroundColor: skyFill.pressed, boxShadow: 'none' },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  words: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  label: { flexShrink: 1 },
  // The half you're not on is a step quieter, picture and all.
  iconOff: { opacity: 0.7 },
});
