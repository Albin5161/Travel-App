import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { useTone } from '@/theme/tone';
import { colors, fonts, light } from '@/theme/tokens';

export type TextVariant =
  | 'displayXL'
  | 'display'
  | 'headline'
  | 'title'
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
    title: colors.mist,
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
    title: light.ink,
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

// Two voices. Jakarta carries every heading: the bigger it gets, the heavier and tighter it sets
// (tracking runs from -0.017 em at title size to -0.036 em at displayXL), so large type reads as
// one shape instead of a row of letters. Geist carries everything you read, at its own spacing.
// Every style sets a line height: without one, Text inherits body's 22 and iOS crops the tops.
const styles = StyleSheet.create({
  displayXL: { fontFamily: fonts.display, fontSize: 44, lineHeight: 49, letterSpacing: -1.6 },
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -1.1 },
  headline: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 27, letterSpacing: -0.5 },
  title: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  // Caps whisper rather than shout: 0.08 em, not the 0.18 em of a generated landing page.
  micro: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  data: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
});
