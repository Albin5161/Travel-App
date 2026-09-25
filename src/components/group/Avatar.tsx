import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import type { Friend } from '@/data/group';
import { fonts, light } from '@/theme/tokens';

type Props = { friend: Friend; size?: number; style?: StyleProp<ViewStyle> };

// A friend as a pale disc with their initial. The white ring separates overlapping avatars.
export function Avatar({ friend, size = 36, style }: Props) {
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: friend.tint, borderWidth: size > 28 ? 2 : 1.5 },
        style,
      ]}
      accessibilityLabel={friend.name}
    >
      <Text style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.52 }]}>{friend.name[0]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', borderColor: light.panel },
  initial: { fontFamily: fonts.displayBold, color: light.ink },
});
