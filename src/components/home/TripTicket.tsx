import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Ticket } from '@/components/home/Ticket';
import { Text } from '@/components/Text';
import { getCity } from '@/data/api';
import { formatRange } from '@/data/planner';
import { formatClock } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { fadeUp } from '@/lib/motion';
import { useTrips, type TripAhead } from '@/state/trips';
import { skyCta } from '@/theme/sky';
import { fonts, light, radii } from '@/theme/tokens';

const ENTER = fadeUp(80);

/** "in 4 days", "is tomorrow", "is today": the tail of a sentence that starts with the city. */
export function aheadTail(inDays: number) {
  return inDays === 0 ? 'is today' : inDays === 1 ? 'is tomorrow' : `in ${inDays} days`;
}

/** Opens a saved trip's plan. */
export function openTrip(cityId: string) {
  haptic.light();
  router.push({ pathname: '/plan/[id]', params: { id: cityId } });
}

/**
 * The next trip, at the top of Home as a ticket: how long till it starts on the stub, where the
 * first day begins, and one way in. On the day itself it says which stop is next instead.
 */
export function TripTicket({ ahead }: { ahead: TripAhead }) {
  const { state } = useTrips();
  const city = getCity(ahead.cityId);
  const plan = state.tripPlans[ahead.cityId];
  const start = plan?.days[0]?.date;
  if (!city || !plan || !start) return null;

  const on = ahead.inDays === 0;
  const day = plan.days[ahead.day];
  const stops = plan.days.reduce((n, d) => n + d.stops.length, 0);
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const next = on ? day.stops.find((s) => s.startMinutes >= now) : day.stops[0];
  const line = next
    ? `${on ? 'Next' : 'Starts at'} ${next.place.name}, ${formatClock(next.startMinutes)}`
    : on
      ? 'The last stop of the day is behind you'
      : null;
  const when = `${formatRange(start, plan.days.length)} · ${stops} ${stops === 1 ? 'stop' : 'stops'}`;
  const many = plan.days.length > 1;
  const cta = on ? 'See today' : 'See the plan';

  return (
    <Animated.View entering={ENTER}>
      <Ticket
        photo={city.hero}
        onPress={() => openTrip(city.id)}
        accessibilityLabel={`${city.name} ${aheadTail(ahead.inDays)}. ${when}.${line ? ` ${line}.` : ''} ${cta}.`}
        stub={
          on && !many ? (
            <Text variant="label" style={styles.unit}>
              Today
            </Text>
          ) : (
            <View style={styles.count}>
              {on ? (
                <Text variant="micro" color={light.inkSoft}>
                  Day
                </Text>
              ) : null}
              <Text style={styles.number}>{on ? ahead.day + 1 : ahead.inDays}</Text>
              <Text variant="micro" color={light.inkSoft}>
                {on ? `of ${plan.days.length}` : ahead.inDays === 1 ? 'day' : 'days'}
              </Text>
            </View>
          )
        }
      >
        <Text variant="title" numberOfLines={1}>
          {city.name}
        </Text>
        <Text variant="label" color={light.inkSoft} numberOfLines={1}>
          {when}
        </Text>
        {line ? (
          <Text variant="label" numberOfLines={2} style={styles.line}>
            {line}
          </Text>
        ) : null}
        {/* The whole ticket is the tap; this is what says so. */}
        <View style={styles.cta}>
          <Text variant="label" color="#FFFFFF">
            {cta}
          </Text>
          <Feather name="arrow-right" size={14} color="#FFFFFF" />
        </View>
      </Ticket>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  count: { alignItems: 'center' },
  number: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: light.ink, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.sansSemi },
  line: { marginTop: 6 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    marginTop: 10,
    borderRadius: radii.pill,
    backgroundColor: skyCta,
  },
});
