import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { useTone } from '@/theme/tone';
import { colors, fonts, light } from '@/theme/tokens';

export type TextVariant =
  | 'displayXL'
  | 'display'
  | 'headline'
  | 'serifItalic'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'micro'
  | 'data';

type Props = TextProps & { variant?: TextVariant; color?: string };

// Default colour per variant for each tone. An explicit `color` always wins.
const INK: Record<'dark' | 'light', Record<TextVariant, string>> = {
  dark: {
    displayXL: colors.mist,
    display: colors.mist,
    headline: colors.mist,
    serifItalic: colors.mist,
    body: colors.stone,
    bodyStrong: colors.mist,
    label: colors.mist,
    micro: colors.ash,
    data: colors.ash,
  },
  light: {
    displayXL: light.ink,
    display: light.ink,
    headline: light.ink,
    serifItalic: light.ink,
    body: light.inkSoft,
    bodyStrong: light.ink,
    label: light.ink,
    micro: light.inkFaint,
    data: light.inkSoft,
  },
};

export function Text({ variant = 'body', color, style, ...rest }: Props) {
  const tone = useTone();
  return <RNText {...rest} style={[styles[variant], { color: color ?? INK[tone][variant] }, style]} />;
}

const styles = StyleSheet.create({
  displayXL: { fontFamily: fonts.serif, fontSize: 52, lineHeight: 54, letterSpacing: -0.5 },
  display: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, letterSpacing: -0.3 },
  headline: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 32 },
  serifItalic: { fontFamily: fonts.serifItalic, fontSize: 22, lineHeight: 28 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  micro: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  data: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
});
