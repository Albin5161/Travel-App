import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTone } from '@/theme/tone';
import { skyCta, skyFill, skyInk } from '@/theme/sky';
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
  const sky = tone === 'sky';
  // Over the sky the main button is a black pill with its arrow at the far end, not after the words.
  const skyArrow = sky && kind === 'primary' && !!trailingArrow && !compact;
  const text = trailingArrow && !skyArrow ? `${label} →` : label;
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
          sky && (primary ? styles.primarySky : styles.secondarySky),
          skyArrow && styles.tall,
          disabled && styles.disabled,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.label, skyArrow && styles.labelSky, { color: LABEL[tone][primary ? 'primary' : 'secondary'] }]}
        >
          {text}
        </Text>
        {skyArrow ? <Feather name="arrow-right" size={22} color={skyInk.strong} style={styles.arrow} /> : null}
      </PressableScale>
    </View>
  );
}

const LABEL = {
  dark: { primary: colors.night, secondary: colors.mist },
  // Over the sky: black with white type, the one solid thing on a screen of glass.
  sky: { primary: skyInk.strong, secondary: skyInk.strong },
  light: { primary: light.ctaInk, secondary: light.ink },
} as const;

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
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
  // A faint light rim keeps the black edge visible against a night sky.
  primarySky: {
    backgroundColor: skyCta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
    boxShadow: '0 10px 28px rgba(0,0,0,0.32)',
  },
  secondarySky: {
    backgroundColor: skyFill.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  // Room either side so a long label never runs under the arrow.
  tall: { height: 60, paddingHorizontal: 56 },
  labelSky: { fontSize: 17 },
  arrow: { position: 'absolute', right: 24 },
  disabled: { opacity: 0.4, boxShadow: 'none' },
  label: { fontFamily: fonts.sansSemi, fontSize: 16, letterSpacing: 0.1 },
  textWrap: { alignItems: 'center' },
  // 44pt tall: the web ignores hitSlop, so the tap has to be the button itself.
  textButton: { minHeight: 44, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  textLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ash },
});
