import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PlanPass } from '@/components/share/PlanPass';
import { TiltCard } from '@/components/share/TiltCard';
import { Text } from '@/components/Text';
import { getCity } from '@/data/api';
import { haptic } from '@/lib/haptics';
import { FADE_IN, fadeUp } from '@/lib/motion';
import { planMessage, sharePlanCard } from '@/lib/share';
import { useTrips } from '@/state/trips';
import { light } from '@/theme/tokens';

const HEAD_IN = fadeUp(0);
const TITLE_IN = fadeUp(60);

// After the passport stamp: the plan, as a card you can tilt, ready to send to the group.
// Arrived at by replacing the plan screen, so there's no back; "Done for now" goes home.
export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const city = getCity(id);
  const { state } = useTrips();
  const plan = state.tripPlans[id];
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const card = useRef<View>(null);
  const [issued] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Nothing to share without a plan (a reload wipes the in-memory store): go home.
  useEffect(() => {
    if (!plan) router.dismissTo('/');
  }, [plan]);

  if (!city || !plan) return null;
  const stops = plan.days.reduce((sum, d) => sum + d.stops.length, 0);

  const cardW = Math.min(W - 64, 340);
  const room = H - insets.top - insets.bottom - 150 - 150;
  const cardH = Math.max(400, Math.min(Math.round(cardW * 1.42), room));

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await sharePlanCard(card, planMessage(city.name, city.id, stops, plan.days.length));
      if (result === 'shared') {
        haptic.success();
        setNote('Sent. Now get everyone to agree.');
      } else if (result === 'copied') {
        haptic.light();
        setNote('Message copied. Paste it in your group.');
      }
    } catch {
      setNote('Couldn’t open sharing. Try again?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.head}>
        <Animated.View entering={HEAD_IN}>
          <Text variant="micro">
            {city.name} · {plan.days.length === 1 ? 'day planned' : `${plan.days.length} days planned`}
          </Text>
        </Animated.View>
        <Animated.View entering={TITLE_IN}>
          <Text variant="display" style={styles.title}>
            {'Your Xplore plan\nis ready'}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.stage}>
        <TiltCard width={cardW} height={cardH} delay={160} faceRef={card}>
          <PlanPass city={city} plan={plan} width={cardW} height={cardH} issued={issued} />
        </TiltCard>
      </View>

      <View style={styles.actions}>
        {note ? (
          <Animated.View entering={FADE_IN}>
            <Text variant="label" color={light.inkSoft} style={styles.note}>
              {note}
            </Text>
          </Animated.View>
        ) : null}
        {note ? (
          <Button label="See who’s voting" onPress={() => router.push({ pathname: '/group/[id]', params: { id } })} />
        ) : (
          <Button label="Share to group" onPress={share} disabled={busy} />
        )}
        <Button kind="text" label={note ? 'Done' : 'Done for now'} onPress={() => router.dismissTo('/')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  head: { paddingHorizontal: 28 },
  title: { marginTop: 8 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: 20, gap: 4 },
  note: { textAlign: 'center', marginBottom: 8 },
});
