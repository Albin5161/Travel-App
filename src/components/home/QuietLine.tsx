import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { skyAccent, skyInk } from '@/theme/sky';
import { fonts } from '@/theme/tokens';

/**
 * Something on Home that can wait, said in one line under the card that can't: what it is, where
 * it stands, and a tap to go there.
 */
export function QuietLine({ lead, rest, onPress }: { lead: string; rest: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`${lead} ${rest}`}>
      <View style={styles.dot} />
      <Text variant="label" color={skyInk.soft} numberOfLines={1} style={styles.text}>
        <Text variant="label" style={styles.lead}>
          {lead}
        </Text>{' '}
        {rest}
      </Text>
      <Feather name="chevron-right" size={16} color={skyInk.faint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // 44pt, as every tap target, though the line itself is small.
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: skyAccent },
  text: { flex: 1 },
  lead: { fontFamily: fonts.sansSemi },
});
