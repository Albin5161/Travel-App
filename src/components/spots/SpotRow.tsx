import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { getReel } from '@/data/api';
import type { Place, SpotStatus } from '@/data/types';
import { formatDuration } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { light } from '@/theme/tokens';

/**
 * One saved spot. The line under the name is what makes it actionable: how long the drive is, and
 * who put it in your head in the first place — the creator is an Xplore-specific memory hook.
 */
export function SpotRow({
  spot,
  minutes,
  status,
  onPress,
  onToggleStatus,
}: {
  spot: Place;
  /** Drive time from where you are; null for a far city, whose distance is said once above. */
  minutes: number | null;
  status: SpotStatus;
  onPress: () => void;
  onToggleStatus: () => void;
}) {
  const creator = spot.source.kind === 'reel' ? getReel(spot.source.reelId)?.creator : null;
  const been = status === 'been';
  return (
    <PressableScale onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={spot.name}>
      <Image source={spot.photo} style={[styles.thumb, been && styles.thumbBeen]} contentFit="cover" transition={0} />
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={1} color={been ? light.inkFaint : light.ink}>
          {spot.name}
        </Text>
        <Text variant="data" numberOfLines={1}>
          {/* The cluster heading above already names the area, so the second half of this line
              goes to the creator — which is what makes you remember why you saved it. */}
          {[minutes === null ? null : `${formatDuration(minutes)} away`, creator ?? spot.area].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          haptic.light();
          onToggleStatus();
        }}
        hitSlop={10}
        style={[styles.check, been && styles.checkOn]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: been }}
        accessibilityLabel={been ? `Mark ${spot.name} as not visited` : `Mark ${spot.name} as been`}
      >
        <Feather name="check" size={13} color={been ? light.ctaInk : light.inkFaint} />
      </Pressable>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  thumb: { width: 52, height: 52, borderRadius: 14, backgroundColor: light.canvasTop },
  thumbBeen: { opacity: 0.45 },
  body: { flex: 1, gap: 2 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: light.line,
    backgroundColor: light.canvas,
  },
  checkOn: { backgroundColor: light.cta, borderColor: light.cta },
});
