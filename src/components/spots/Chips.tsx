import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { skyFill, skyInk, skyOnInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { light } from '@/theme/tokens';

/** Horizontal filter chips: the kind of spot, each with a small line icon when given one. */
export function Chips<T extends string | number | null>({
  options,
  value,
  onChange,
  lead,
}: {
  options: { key: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (key: T) => void;
  /** Something before the chips in the same row, such as a search button. */
  lead?: ReactNode;
}) {
  const sky = useTone() === 'sky';
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled"
    >
      {lead}
      {options.map((o) => {
        const active = o.key === value;
        const ink = sky ? (active ? skyOnInk : skyInk.soft) : active ? light.ctaInk : light.inkSoft;
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
            {o.icon ? <Icon name={o.icon} size={16} color={ink} weight={active ? 'fill' : 'regular'} /> : null}
            <Text variant="label" color={ink}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipRow: { gap: 8, paddingRight: 8, alignItems: 'center' },
  chip: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
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
