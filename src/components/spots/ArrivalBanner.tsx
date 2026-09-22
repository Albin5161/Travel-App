import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { FADE_OUT, NUDGE_IN } from '@/lib/motion';
import { light, shadows } from '@/theme/tokens';

/**
 * The in-app half of an arrival. If the notification was tapped, or arrived while the app was open,
 * the same message is here too — so the flow is never a dead end when notifications are off.
 */
export function ArrivalBanner({
  district,
  spots,
  topArea,
  onSee,
  onDismiss,
}: {
  district: string;
  spots: number;
  topArea: string | null;
  onSee: () => void;
  onDismiss: () => void;
}) {
  return (
    <Animated.View entering={NUDGE_IN} exiting={FADE_OUT} style={styles.wrap}>
      <View style={styles.icon}>
        <Feather name="map-pin" size={15} color={light.ctaInk} />
      </View>
      <View style={styles.body}>
        <Text variant="bodyStrong">You&rsquo;re in {district}</Text>
        <Text variant="data">
          {spots} {spots === 1 ? 'spot you saved is' : 'spots you saved are'} here
          {topArea ? ` · around ${topArea}` : ''}
        </Text>
        <PressableScale onPress={onSee} style={styles.cta} accessibilityRole="button">
          <Text variant="label" color={light.ctaInk}>
            See them
          </Text>
        </PressableScale>
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Feather name="x" size={16} color={light.inkFaint} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.lineStrong,
    boxShadow: shadows.button,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: light.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 8,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: light.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
