import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTone } from '@/theme/tone';
import { skyInk } from '@/theme/sky';
import { colors, fonts, light, shadows } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Kind = 'primary' | 'secondary' | 'text';

type Props = {
  label: string;
  onPress: () => void;
  kind?: Kind;
  disabled?: boolean;
  trailingArrow?: boolean;
  compact?: boolean;
  /** Layout only (flex, margins, alignment). The button owns its own look. */
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export function Button({ label, onPress, kind = 'primary', disabled, trailingArrow, compact, style, accessibilityHint }: Props) {
  const tone = useTone();
  const text = trailingArrow ? `${label} →` : label;
  if (kind === 'text') {
    return (
      <View style={[styles.textWrap, style]}>
        <PressableScale
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityHint={accessibilityHint}
          style={styles.textButton}
          hitSlop={12}
        >
          <Text style={[styles.textLabel, tone === 'light' && { color: light.inkSoft }, tone === 'sky' && { color: skyInk.soft }]}>{text}</Text>
        </PressableScale>
      </View>
    );
  }
  const primary = kind === 'primary';
  return (
    <View style={style}>
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityHint={accessibilityHint}
        style={[
          styles.button,
          compact && styles.compact,
          primary ? styles.primary : styles.secondary,
          tone === 'light' && (primary ? styles.primaryLight : styles.secondaryLight),
          tone === 'sky' && primary && styles.primarySky,
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.label, { color: LABEL[tone][primary ? 'primary' : 'secondary'] }]}>{text}</Text>
      </PressableScale>
    </View>
  );
}

const LABEL = {
  dark: { primary: colors.night, secondary: colors.mist },
  // Over the sky: a white button with dark type, the one solid thing on a screen of glass.
  sky: { primary: colors.night, secondary: colors.mist },
  light: { primary: light.ctaInk, secondary: light.ink },
} as const;

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  compact: { height: 46 },
  primary: {
    backgroundColor: colors.ember,
    boxShadow: '0 8px 24px rgba(226,118,60,0.45)',
  },
  secondary: {
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.rim,
  },
  // Light direction: solid black with white text.
  primaryLight: { backgroundColor: light.cta, boxShadow: shadows.cta },
  secondaryLight: { backgroundColor: light.panel, borderColor: light.lineStrong },
  primarySky: { backgroundColor: '#FFFFFF', boxShadow: '0 8px 24px rgba(4,10,30,0.22)' },
  disabled: { opacity: 0.4, boxShadow: 'none' },
  label: { fontFamily: fonts.sansSemi, fontSize: 16, letterSpacing: 0.1 },
  textWrap: { alignItems: 'center' },
  textButton: { paddingVertical: 10, paddingHorizontal: 4 },
  textLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ash },
});
