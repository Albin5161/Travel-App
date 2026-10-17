import { StyleSheet, Text as RNText } from 'react-native';

import { skyInk } from '@/theme/sky';
import { fonts } from '@/theme/tokens';

/**
 * The Xplore logo, set in type. It's the brand, not a text style, so it keeps its own size off the
 * type scale and is drawn only through here: one place to change it, or to swap in a drawn logo.
 */
export function Wordmark() {
  return (
    <RNText style={styles.mark}>Xplore</RNText>
  );
}

const styles = StyleSheet.create({
  mark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.9, color: skyInk.strong },
});
