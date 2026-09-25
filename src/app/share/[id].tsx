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
import { PARTY_COPY } from '@/data/group';
import { partyOf } from '@/data/planner';
import { haptic } from '@/lib/haptics';
import { FADE_IN, fadeUp } from '@/lib/motion';
import { planMessage, sharePlanCard } from '@/lib/share';
import { startGroup } from '@/state/group';
import { useTrips } from '@/state/trips';
import { light } from '@/theme/tokens';

const HEAD_IN = fadeUp(0);
const TITLE_IN = fadeUp(60);

// After the passport stamp: the plan, as a card you can tilt, ready to send to whoever's going.
// Sharing starts their vote. Arrived at by replacing the plan screen, so there's no back; "Done"
// goes to the Trips tab, where the trip now lives.
export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const city = getCity(id);
  const { state, dispatch } = useTrips();
  const plan = state.tripPlans[id];
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const card = useRef<View>(null);
  const [issued] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Nothing to share without a plan (a reload wipes the in-memory store): go home.
  useEffect(() => {
    if (!plan) router.dismissTo('/');
  }, [plan]);

  if (!city || !plan) return null;
  const stops = plan.days.reduce((sum, d) => sum + d.stops.length, 0);
  const party = partyOf(plan.prefs);
  const copy = PARTY_COPY[party];

  const cardW = Math.min(W - 64, 340);
  const room = H - insets.top - insets.bottom - 150 - 150;
  const cardH = Math.max(400, Math.min(Math.round(cardW * 1.42), room));

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await sharePlanCard(card, planMessage(city.name, city.id, stops, plan.days.length, party));
      if (result === 'dismissed') return;
      if (result === 'shared') haptic.success();
      else haptic.light();
      setSent(true);
      // The vote starts the moment it's out: people begin joining while you're still in the chat.
      startGroup(dispatch, plan);
      setNote(
        result === 'copied'
          ? `Message copied. Paste it in your ${party === 'family' ? 'family chat' : party === 'partner' ? 'chat' : 'group'}.`
          : party === 'solo'
            ? 'Sent.'
            : 'Sent. Now get everyone to agree.',
      );
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
        {sent && party !== 'solo' ? (
          <Button label={copy.see} onPress={() => router.push({ pathname: '/group/[id]', params: { id } })} />
        ) : sent ? (
          <Button label="Done" onPress={() => router.dismissTo('/trips')} />
        ) : (
          <Button label={copy.share} onPress={share} disabled={busy} />
        )}
        {sent && party === 'solo' ? null : (
          <Button kind="text" label={sent ? 'Done' : 'Done for now'} onPress={() => router.dismissTo('/trips')} />
        )}
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
