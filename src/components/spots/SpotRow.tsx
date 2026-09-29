import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Tick } from '@/components/sky/Tick';
import { Text } from '@/components/Text';
import { getReel } from '@/data/api';
import type { Place, SpotStatus } from '@/data/types';
import { formatDuration } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { skyFill, skyInk } from '@/theme/sky';

/**
 * One saved spot. The line under the name is what makes it actionable: how long the drive is, and
 * who put it in your head in the first place — the creator is an Xplore-specific memory hook.
 */
const TYPE: Record<Place['type'], string> = { food: 'Food', stay: 'Stay', sight: 'Sight', experience: 'Experience' };

export function SpotRow({
  spot,
  minutes,
  status,
  onPress,
  onToggleStatus,
  showCreator = true,
}: {
  spot: Place;
  /** Drive time from where you are; null for a far city, whose distance is said once above. */
  minutes: number | null;
  status: SpotStatus;
  onPress: () => void;
  onToggleStatus: () => void;
  /** Name the creator on the row; off when every spot around it is from the same one. */
  showCreator?: boolean;
}) {
  const creator = spot.source.kind === 'reel' ? getReel(spot.source.reelId)?.creator : null;
  const been = status === 'been';
  return (
    <PressableScale onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={spot.name}>
      <Image source={spot.photo} style={[styles.thumb, been && styles.thumbBeen]} contentFit="cover" transition={0} />
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={1} color={been ? skyInk.faint : skyInk.strong}>
          {spot.name}
        </Text>
        <Text variant="data" numberOfLines={1}>
          {/* The cluster heading above already names the area, so the second half of this line
              goes to the creator — which is what makes you remember why you saved it. */}
          {[minutes === null ? null : `${formatDuration(minutes)} away`, (showCreator && creator) || TYPE[spot.type]].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          haptic.light();
          onToggleStatus();
        }}
        hitSlop={10}
        style={styles.check}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: been }}
        accessibilityLabel={been ? `Mark ${spot.name} as not visited` : `Mark ${spot.name} as been`}
      >
        <Tick on={been} />
        {/* Said, not just ticked: an unlabelled tick read as "pin it" or "select". */}
        <Text variant="micro" color={been ? skyInk.strong : skyInk.soft} style={styles.checkLabel}>
          Been
        </Text>
      </Pressable>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  thumb: { width: 52, height: 52, borderRadius: 14, backgroundColor: skyFill.raised },
  thumbBeen: { opacity: 0.45 },
  body: { flex: 1, gap: 2 },
  // Padded so the tick's tap area is 44pt: the web ignores hitSlop.
  check: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  checkLabel: { fontSize: 10, lineHeight: 12, letterSpacing: 0.6 },
});
