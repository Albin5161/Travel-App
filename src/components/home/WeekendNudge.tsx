import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Glass } from '@/components/sky/Glass';
import { Text } from '@/components/Text';
import { skyInk } from '@/theme/sky';

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** Thursday to Saturday: close enough to the weekend to act on, and gone before it's wallpaper. */
export function weekendIsNear(date = new Date()) {
  return date.getDay() >= 4;
}

/**
 * The places saved near home, offered as a reason to go out this weekend. Shown from Thursday; a
 * tap turns Home to Near Home, which is also what puts it away.
 */
export function WeekendNudge({ count, onPress }: { count: number; onPress: () => void }) {
  const title = new Date().getDay() === 6 ? 'Free today?' : 'Free this Saturday?';
  const line =
    count === 1 ? 'One of your places is near home.' : `${WORDS[count] ?? count} of your places are near home.`;
  return (
    <Glass>
      <PressableScale onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`${title} ${line} Show them.`}>
        <View style={styles.text}>
          <Text variant="title">{title}</Text>
          <Text variant="label" color={skyInk.soft}>
            {line}
          </Text>
        </View>
        <Feather name="arrow-right" size={18} color={skyInk.soft} />
      </PressableScale>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 18, minHeight: 44 },
  text: { flex: 1, gap: 3 },
});
