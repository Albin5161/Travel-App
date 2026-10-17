import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Glass } from '@/components/sky/Glass';
import { Text } from '@/components/Text';
import { FADE_IN, FADE_OUT } from '@/lib/motion';
import { useOffline } from '@/lib/online';
import { skyInk } from '@/theme/sky';

/**
 * A small line over the tab bar while there's no connection, so being offline is known before
 * something fails rather than because it did. It says what still works, since most of the app does:
 * everything saved is on the phone. Gone the moment the connection is back.
 */
export function OfflineNote() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <Animated.View entering={FADE_IN} exiting={FADE_OUT} style={styles.wrap} pointerEvents="none" accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Glass blur radius={18} style={styles.note}>
        <Feather name="wifi-off" size={14} color={skyInk.strong} />
        <View style={styles.words}>
          <Text variant="label" numberOfLines={1}>
            You’re offline
          </Text>
          <Text variant="label" ink="soft" tabular color={skyInk.soft} numberOfLines={1}>
            Saved places and plans still work
          </Text>
        </View>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16 },
  words: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
});
