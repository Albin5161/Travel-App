import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { fadeUp } from '@/lib/motion';
import { light } from '@/theme/tokens';

type Props = {
  ownerName: string;
  cityName: string;
  stops: number;
  days: number;
  onStart: () => void;
  onDismiss: () => void;
};

const STEPS: { icon: keyof typeof Feather.glyphMap; title: string; body: (owner: string) => string }[] = [
  { icon: 'check-circle', title: 'Vote on each stop', body: () => 'Keep it, swap it for something nearby, or drop it. Add a note to say why.' },
  { icon: 'plus-circle', title: 'Suggest your own', body: () => 'Add a stop you’d like: lunch at a café, a viewpoint, a place from your own reels.' },
  { icon: 'lock', title: 'Then it’s settled', body: (owner) => `When everyone has voted, ${owner} locks in the plan you agreed on.` },
];

/**
 * What a friend sees once, right after joining from a shared link: whose plan this is, and the three
 * things they can do with it. Arriving on someone else's list of stops with no word of what's
 * expected is the moment people close the tab.
 */
export function JoinWelcome({ ownerName, cityName, stops, days, onStart, onDismiss }: Props) {
  const span = days > 1 ? `${days} days` : 'a day';
  return (
    <Animated.View entering={fadeUp(0)} style={styles.card} accessibilityRole="summary">
      <Text variant="micro">You’re in</Text>
      <Text variant="headline" style={styles.title}>
        {ownerName} picked {stops} {stops === 1 ? 'place' : 'places'} for {span} in {cityName}
      </Text>
      <View style={styles.steps}>
        {STEPS.map((s) => (
          <View key={s.title} style={styles.step}>
            <View style={styles.icon}>
              <Feather name={s.icon} size={18} color={light.ink} />
            </View>
            <View style={styles.stepText}>
              <Text variant="bodyStrong">{s.title}</Text>
              <Text variant="label" color={light.inkSoft}>
                {s.body(ownerName)}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Button label="Start voting" onPress={onStart} />
      <Button kind="text" label="Look at the plan first" onPress={onDismiss} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 20,
    gap: 6,
    borderRadius: 24,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
  },
  title: { marginBottom: 8 },
  steps: { gap: 14, marginVertical: 10 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.canvasTop,
  },
  stepText: { flex: 1, gap: 2 },
});
