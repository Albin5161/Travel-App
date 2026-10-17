import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { useTone } from '@/theme/tone';
import { skyInk } from '@/theme/sky';
import { colors, fonts, light, textSize } from '@/theme/tokens';

// Six styles on six sizes (see fontSize in tokens). hero is the one exception: a city or place name.
export type TextVariant = 'hero' | 'display' | 'headline' | 'title' | 'body' | 'bodyStrong' | 'label' | 'tag';

/** strong for what you read first, soft for reading text, faint for what can be skipped. */
export type Ink = 'strong' | 'soft' | 'faint';

type Props = TextProps & {
  variant?: TextVariant;
  /** Which of the three inks; each variant has its own default. An explicit `color` always wins. */
  ink?: Ink;
  /** Even-width figures, so counts, dates and prices line up and don't jiggle as they change. */
  tabular?: boolean;
  color?: string;
};

const INK: Record<'dark' | 'light' | 'sky', Record<Ink, string>> = {
  dark: { strong: colors.mist, soft: colors.stone, faint: colors.ash },
  light: { strong: light.ink, soft: light.inkSoft, faint: light.inkFaint },
  sky: { strong: skyInk.strong, soft: skyInk.soft, faint: skyInk.faint },
};

const DEFAULT_INK: Record<TextVariant, Ink> = {
  hero: 'strong',
  display: 'strong',
  headline: 'strong',
  title: 'strong',
  body: 'soft',
  bodyStrong: 'strong',
  label: 'strong',
  // A tag is already as small as type gets, so it never goes quieter than the darkest ink.
  tag: 'strong',
};

export function Text({ variant = 'body', ink, tabular, color, style, ...rest }: Props) {
  const tone = useTone();
  return (
    <RNText
      {...rest}
      style={[
        styles[variant],
        { color: color ?? INK[tone][ink ?? DEFAULT_INK[variant]] },
        tabular && styles.tabular,
        style,
      ]}
    />
  );
}

// Two voices. Jakarta carries every heading: the bigger it gets, the heavier and tighter it sets
// (tracking runs from -0.017 em at title size to -0.036 em at hero), so large type reads as one
// shape instead of a row of letters. Geist carries everything you read, at its own spacing.
// Every style sets a line height: without one, Text inherits body's and iOS crops the tops.
// Jakarta sits tall, so its line heights stay at 1.1x the size or more.
const styles = StyleSheet.create({
  hero: { fontFamily: fonts.display, ...textSize.hero, letterSpacing: -1.4 },
  display: { fontFamily: fonts.display, ...textSize.display, letterSpacing: -1 },
  headline: { fontFamily: fonts.displayBold, ...textSize.headline, letterSpacing: -0.45 },
  title: { fontFamily: fonts.displaySemi, ...textSize.title, letterSpacing: -0.25 },
  body: { fontFamily: fonts.sans, ...textSize.body },
  bodyStrong: { fontFamily: fonts.sansMedium, ...textSize.body },
  // Small print, set as it's written. Not in spaced-out capitals: a small capital label over
  // every block is the mark of a generated screen, and it reads slower than plain words.
  label: { fontFamily: fonts.sansMedium, ...textSize.label },
  tag: { fontFamily: fonts.sansSemi, ...textSize.tag, letterSpacing: 0.1 },
  tabular: { fontVariant: ['tabular-nums'] },
});
