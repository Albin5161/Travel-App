import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/Button';
import { PlaceCard } from '@/components/PlaceCard';
import { Text } from '@/components/Text';
import { getPlace } from '@/data/api';
import { usePlaceInfo } from '@/lib/details';
import { useTrips } from '@/state/trips';
import { light } from '@/theme/tokens';

export default function PlaceSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = getPlace(id);
  const { state, dispatch } = useTrips();
  const { height: H } = useWindowDimensions();
  const { info, loading } = usePlaceInfo(place);
  if (!place) return null;

  const skipped = !!state.skipped[place.id];
  // Google's own link opens the place itself; coordinates are the fallback for the samples.
  const openMaps = () =>
    Linking.openURL(
      info?.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${place.coords.lat},${place.coords.lng}`,
    );

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <PlaceCard place={place} style={{ height: Math.min(H * 0.56, 480) }} />
      <View style={styles.actions}>
        <Button kind="secondary" label="Open in Maps" onPress={openMaps} style={styles.action} />
        <Button
          kind={skipped ? 'primary' : 'secondary'}
          label={skipped ? 'Keep in trip' : 'Skip this one'}
          onPress={() => dispatch({ type: 'decide', placeId: place.id, keep: skipped })}
          style={styles.action}
        />
      </View>
      {skipped ? (
        <Text variant="label" color={light.inkFaint} style={styles.note}>
          Skipped. It won’t be in your day plan.
        </Text>
      ) : null}
      {info ? (
        <OnGoogle info={info} onOpen={openMaps} />
      ) : loading ? (
        <Text variant="label" color={light.inkFaint} style={styles.note}>
          Checking what people say on Google…
        </Text>
      ) : null}
    </ScrollView>
  );
}

type Info = NonNullable<ReturnType<typeof usePlaceInfo>['info']>;

/**
 * What Google knows about the place: rating, price, whether it's open, today's hours and a few
 * reviews, each credited to its author as Google requires, with the way to all of them on Maps.
 */
function OnGoogle({ info, onOpen }: { info: Info; onOpen: () => void }) {
  // Google lists the week from Monday; JavaScript's week starts on Sunday.
  const today = info.hours[(new Date().getDay() + 6) % 7]?.replace(/^[^:]+:\s*/, '');
  const facts = [
    info.priceLevel ? '₹'.repeat(info.priceLevel) : null,
    info.openNow === null ? null : info.openNow ? 'Open now' : 'Closed now',
    today ? `Today ${today}` : null,
  ].filter(Boolean);
  return (
    <View style={styles.google}>
      <Text variant="micro">On Google</Text>
      {info.rating !== null ? (
        <View style={styles.ratingRow}>
          <Text variant="headline">{info.rating.toFixed(1)}</Text>
          <Feather name="star" size={16} color={light.ink} />
          {info.ratingCount !== null ? (
            <Text variant="label" color={light.inkSoft}>
              {info.ratingCount.toLocaleString('en-IN')} {info.ratingCount === 1 ? 'review' : 'reviews'}
            </Text>
          ) : null}
        </View>
      ) : null}
      {facts.length ? (
        <Text variant="label" color={light.inkSoft}>
          {facts.join(' · ')}
        </Text>
      ) : null}
      {info.summary ? <Text variant="body">{info.summary}</Text> : null}
      {info.reviews.map((r) => (
        <View key={`${r.author}-${r.when}`} style={styles.review}>
          <Text variant="label" color={light.inkSoft}>
            <Text
              variant="label"
              style={r.authorUri ? styles.link : undefined}
              onPress={r.authorUri ? () => void Linking.openURL(r.authorUri!).catch(() => {}) : undefined}
            >
              {r.author}
            </Text>
            {r.rating !== null ? ` · ${r.rating}★` : ''}
            {r.when ? ` · ${r.when}` : ''}
          </Text>
          <Text variant="body" numberOfLines={5}>
            {r.text}
          </Text>
        </View>
      ))}
      <Text variant="label" style={[styles.link, styles.more]} onPress={onOpen} accessibilityRole="link">
        {info.reviews.length ? 'All reviews on Google Maps' : 'See it on Google Maps'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  google: { marginTop: 28, gap: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  review: { gap: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: light.line },
  link: { color: light.ink, textDecorationLine: 'underline' },
  more: { marginTop: 4 },
  fill: { flex: 1, backgroundColor: light.panel },
  content: { padding: 16, paddingTop: 24, paddingBottom: 40 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  action: { flex: 1 },
  note: { marginTop: 12, textAlign: 'center' },
});
