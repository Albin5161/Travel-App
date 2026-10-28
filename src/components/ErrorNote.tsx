import { Icon } from '@/components/Icon';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import { isLight } from '@/theme/mode';
import { red } from '@/theme/primitives';
import { useTone } from '@/theme/tone';
import { fonts } from '@/theme/tokens';

/**
 * Something went wrong, said in red words with an alert icon: the one place red is used. Dark red on
 * paper (the Light look, or a paper card); on the sky or a photo, the reddest reds that still read
 * on blue (theme/primitives). Screen readers hear it as it appears.
 */
export function ErrorNote({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  const tone = useTone();
  const onPaper = tone === 'light' || (tone === 'sky' && isLight);
  // On the sky the words take the reddest red that reads as text (4.5:1) and the icon a stronger
  // one (3:1 is enough for an icon), so the red still says "error" at a glance.
  const ink = onPaper ? red[700] : red[200];
  const icon = onPaper ? red[700] : red[400];
  return (
    <View style={[styles.note, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name="alert-circle" size={15} color={icon} style={styles.icon} />
      <Text variant="label" color={ink} style={[styles.text, !onPaper && styles.onSky]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, maxWidth: '100%' },
  icon: { marginTop: 2 },
  text: { flexShrink: 1, fontFamily: fonts.sansSemi },
  // A soft shadow lifts the red off the brightest part of a sky.
  onSky: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 4 },
});
