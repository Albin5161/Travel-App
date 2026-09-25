import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import type { Member } from '@/data/group';
import { fonts, light } from '@/theme/tokens';

type Props = { person: Member; size?: number; style?: StyleProp<ViewStyle> };

// Someone on the trip, as a pale disc with their initial. The white ring separates overlapping avatars.
export function Avatar({ person, size = 36, style }: Props) {
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: person.tint, borderWidth: size > 28 ? 2 : 1.5 },
        style,
      ]}
      accessibilityLabel={person.name}
    >
      {person.face ? (
        <Text style={{ fontSize: size * 0.56, lineHeight: size * 0.72 }}>{person.face}</Text>
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.52 }]}>{person.name[0]}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', borderColor: light.panel },
  initial: { fontFamily: fonts.displayBold, color: light.ink },
});
