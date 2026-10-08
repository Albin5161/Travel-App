import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ContinueCard, useDraft } from '@/components/home/ContinueCard';
import { LinkInbox } from '@/components/home/LinkInbox';
import { QuietLine } from '@/components/home/QuietLine';
import { RecapCard } from '@/components/home/RecapCard';
import { TripTicket, aheadTail, openTrip } from '@/components/home/TripTicket';
import { getCity } from '@/data/api';
import { haptic } from '@/lib/haptics';
import { useTripAhead, useTripToRecap, useTrips } from '@/state/trips';

/**
 * Under the link box, the one thing that matters most right now gets a card: links being read, then
 * a trip that's on or coming, then a plan left part-way, then a trip to look back on. Whatever else
 * is waiting is a line each beneath it, so two or three cards never stack up above your places.
 */
export function RightNow() {
  const { state } = useTrips();
  const ahead = useTripAhead();
  const draft = useDraft();
  const recapId = useTripToRecap();
  const tripCity = ahead ? getCity(ahead.cityId) : null;
  const recapCity = recapId ? getCity(recapId) : null;

  const waiting = [
    state.inbox.length > 0 && ('inbox' as const),
    ahead && tripCity && ('trip' as const),
    draft && ('draft' as const),
    recapId && recapCity && ('recap' as const),
  ].filter((k) => !!k);
  const [lead, ...rest] = waiting;
  if (!lead) return null;

  return (
    <View style={styles.stack}>
      {lead === 'inbox' ? (
        <LinkInbox />
      ) : lead === 'trip' && ahead ? (
        <TripTicket ahead={ahead} />
      ) : lead === 'draft' ? (
        <ContinueCard />
      ) : (
        <RecapCard />
      )}
      {rest.length > 0 ? (
        <View>
          {rest.map((kind) =>
            kind === 'trip' && ahead && tripCity ? (
              <QuietLine key={kind} lead={tripCity.name} rest={aheadTail(ahead.inDays)} onPress={() => openTrip(ahead.cityId)} />
            ) : kind === 'draft' && draft ? (
              <QuietLine key={kind} lead={draft.name} rest={draft.quiet} onPress={draft.resume} />
            ) : kind === 'recap' && recapId && recapCity ? (
              <QuietLine
                key={kind}
                lead={`Back from ${recapCity.name}?`}
                rest="Tick where you went"
                onPress={() => {
                  haptic.light();
                  router.push({ pathname: '/recap/[id]', params: { id: recapId } });
                }}
              />
            ) : null,
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { marginTop: 4, gap: 2 },
});
