import { ScrollView, StyleSheet } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { skyFill, skyInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { light } from '@/theme/tokens';

/** Horizontal filter chips: the kind of spot. */
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
  chipSky: { backgroundColor: skyFill.raised, borderColor: skyInk.rim },
  chipSkyOn: { backgroundColor: skyInk.strong, borderColor: skyInk.strong },
});
