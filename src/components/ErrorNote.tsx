import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import { isLight } from '@/theme/mode';
import { red, paper } from '@/theme/primitives';
import { useTone } from '@/theme/tone';

/**
 * Something went wrong, said in red: the one place red is used. On paper (the Light look, or a
 * paper card) it's red words with an alert icon. On the sky or a photo no red text is readable
 * everywhere, so it's white words on a red strip. Screen readers hear it as it appears.
 */
export function ErrorNote({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  const tone = useTone();
  const onPaper = tone === 'light' || (tone === 'sky' && isLight);
  const ink = onPaper ? red[700] : paper[0];
  return (
    <View style={[styles.note, !onPaper && styles.strip, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Feather name="alert-circle" size={14} color={ink} style={styles.icon} />
      <Text variant="label" color={ink} style={styles.text}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  strip: { backgroundColor: red[700], borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  icon: { marginTop: 2 },
  text: { flexShrink: 1 },
});
