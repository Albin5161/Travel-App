import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { formatDuration } from '@/lib/geo';
import type { WeekendRoute } from '@/lib/spots';
import { skyInk } from '@/theme/sky';
import { shadows } from '@/theme/tokens';

/**
 * A whole outing, not a spot. This is the answer to the actual Saturday question — "where can I go
 * that chains two or three stops together" — so the numbers on it are the drive, the time and the money.
 */
export function WeekendRouteCard({
  route,
  width,
  onPress,
}: {
  route: WeekendRoute;
  width: number;
  onPress: () => void;
}) {
  const n = route.spots.length;
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.card, { width }]}
      accessibilityRole="button"
      accessibilityLabel={`${route.label}, ${n} stops, ${formatDuration(route.totalMinutes)}`}
    >
      <View style={styles.photos}>
        {route.spots.slice(0, 3).map((s, i) => (
          <Image
            key={s.id}
            source={s.photo}
            style={[styles.photo, i > 0 && styles.photoStacked]}
            contentFit="cover"
            transition={0}
          />
        ))}
        {n > 3 ? (
          <View style={[styles.photo, styles.photoStacked, styles.more]}>
            <Text variant="data" color={skyInk.soft}>
              +{n - 3}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text variant="micro">
          {n} {n === 1 ? 'stop' : 'stops'}
        </Text>
        <Text variant="headline" numberOfLines={1}>
          {route.label}
        </Text>
        <Text variant="data">
          {formatDuration(route.totalMinutes)} out and back · {formatDuration(route.driveMinutes)} driving
        </Text>
        {route.cost === null ? null : (
          <Text variant="data" color={skyInk.faint}>
            {route.cost === 0 ? 'Free' : `About ₹${route.cost.toLocaleString('en-IN')}`}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: skyInk.line,
    boxShadow: shadows.button,
    overflow: 'hidden',
  },
  photos: { flexDirection: 'row', height: 104, paddingLeft: 14, paddingTop: 14, alignItems: 'center' },
  photo: { width: 74, height: 84, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  photoStacked: { marginLeft: -22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  more: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', width: 48 },
  body: { padding: 16, paddingTop: 12, gap: 3 },
});
