import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Glass } from '@/components/sky/Glass';
import { Text } from '@/components/Text';
import { getCity } from '@/data/api';
import { haptic } from '@/lib/haptics';
import { fadeUp } from '@/lib/motion';
import { useTripToRecap, useTrips } from '@/state/trips';
import { skyFill, skyInk } from '@/theme/sky';
import { radii } from '@/theme/tokens';

const ENTER = fadeUp(80);

/**
 * After a trip's dates are over, one question on Home: did you make it? Answering (a tick per place)
 * is what marks places as been, instead of a tick on every row of the map. The x waves it off for
 * that trip, for good.
 */
export function RecapCard() {
  const { dispatch } = useTrips();
  const id = useTripToRecap();
  const city = id ? getCity(id) : null;
  if (!id || !city) return null;

  return (
    <Animated.View entering={ENTER}>
      <Glass style={styles.card}>
        <PressableScale
          onPress={() => {
            haptic.light();
            router.push({ pathname: '/recap/[id]', params: { id } });
          }}
          style={styles.main}
          accessibilityRole="button"
          accessibilityLabel={`Back from ${city.name}? Tick the places you made it to.`}
        >
          <Image source={city.hero} style={styles.thumb} contentFit="cover" transition={0} />
          <View style={styles.text}>
            <Text variant="eyebrow">Back from {city.name}?</Text>
            <Text variant="title" numberOfLines={2}>
              Tick the places you made it to
            </Text>
          </View>
        </PressableScale>
        <Pressable
          onPress={() => {
            haptic.selection();
            dispatch({ type: 'finishRecap', cityId: id, been: [] });
          }}
          style={styles.stop}
          accessibilityRole="button"
          accessibilityLabel={`Don’t ask about ${city.name}`}
        >
          <Feather name="x" size={14} color={skyInk.faint} />
        </Pressable>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 4 },
  // Right padding keeps the text clear of the x in the corner.
  main: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingRight: 44 },
  thumb: { width: 64, height: 64, borderRadius: radii.pane, backgroundColor: skyFill.pane },
  text: { flex: 1, gap: 3 },
  // Top-right, out of the way of the card's own tap: 44pt, as every tap target.
  stop: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
