import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

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

export function Text({ variant = 'body', color, style, ...rest }: Props) {
  return <RNText {...rest} style={[styles[variant], color ? { color } : null, style]} />;
}

const styles = StyleSheet.create({
  displayXL: { fontFamily: fonts.serif, fontSize: 52, lineHeight: 54, color: colors.mist, letterSpacing: -0.5 },
  display: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, color: colors.mist, letterSpacing: -0.3 },
  headline: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 32, color: colors.mist },
  serifItalic: { fontFamily: fonts.serifItalic, fontSize: 22, lineHeight: 28, color: colors.mist },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.stone },
  bodyStrong: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 22, color: colors.mist },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: colors.mist },
  micro: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.ash,
  },
  data: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: colors.ash, fontVariant: ['tabular-nums'] },
});
