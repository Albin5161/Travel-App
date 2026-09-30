import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Reveal, RevealProvider, useReveal } from '@/components/motion/Reveal';
import { PlaceCard } from '@/components/PlaceCard';
import { Glass } from '@/components/sky/Glass';
import { Tick } from '@/components/sky/Tick';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { SHEET_CLOSE_ROOM, SheetClose } from '@/components/SheetClose';
import { getPlace } from '@/data/api';
import { usePlaceInfo } from '@/lib/details';
import { haptic } from '@/lib/haptics';
import { useSpotStatus, useTrips } from '@/state/trips';
import { skyInk } from '@/theme/sky';
import { space } from '@/theme/tokens';

export default function PlaceSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = getPlace(id);
  const { state, dispatch } = useTrips();
  const { statusOf, toggle } = useSpotStatus();
  const { height: H } = useWindowDimensions();
  const { info, loading } = usePlaceInfo(place);
  const { frame, ...scrollProps } = useReveal();
  const reduced = useReducedMotion();
  // The photo card eases back as the sheet scrolls up: it drifts a little slower than the page
  // and settles smaller, so what's below comes forward.
  const cardStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const y = frame.scrollY.get();
    return {
      transform: [
        { translateY: interpolate(y, [0, 320], [0, 90], Extrapolation.CLAMP) },
        { scale: interpolate(y, [0, 320], [1, 0.92], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(y, [0, 360], [1, 0.55], Extrapolation.CLAMP),
    };
  });
  if (!place) return null;

  const skipped = !!state.skipped[place.id];
  // Google's own link opens the place itself; coordinates are the fallback for the samples.
  const openMaps = () =>
    Linking.openURL(
      info?.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${place.coords.lat},${place.coords.lng}`,
    );

  return (
    <SkyScreen>
    {/* On the web the card starts below the ✕, which would otherwise sit on its photo. */}
    <Animated.ScrollView {...scrollProps} contentContainerStyle={[styles.content, { paddingTop: 24 + SHEET_CLOSE_ROOM }]} showsVerticalScrollIndicator={false}>
      <RevealProvider frame={frame}>
      <Animated.View style={cardStyle}>
        <PlaceCard place={place} style={{ height: Math.min(H * 0.56, 480) }} />
      </Animated.View>
      <Reveal style={styles.actions}>
        <Button kind="secondary" label="Open in Maps" onPress={openMaps} style={styles.action} />
        <Button
          kind={skipped ? 'primary' : 'secondary'}
          label={skipped ? 'Keep in trip' : 'Skip this one'}
          onPress={() => dispatch({ type: 'decide', placeId: place.id, keep: skipped })}
          style={styles.action}
        />
      </Reveal>
      {/* Been here: for a place visited outside a planned trip (a trip's recap asks after its dates). */}
      <Reveal>
        <Pressable
          onPress={() => {
            haptic.selection();
            toggle(place.id);
          }}
          style={styles.been}
          accessibilityRole="checkbox"
          aria-checked={statusOf(place.id) === 'been'}
        >
          <Tick on={statusOf(place.id) === 'been'} />
          <Text variant="label" color={skyInk.soft}>
            I’ve been here
          </Text>
        </Pressable>
      </Reveal>
      {skipped ? (
        <Text variant="label" color={skyInk.faint} style={styles.note}>
          Skipped. It won’t be in your day plan.
        </Text>
      ) : null}
      {info ? (
        <OnGoogle info={info} onOpen={openMaps} />
      ) : loading ? (
        <Text variant="label" color={skyInk.faint} style={styles.note}>
          Checking what people say on Google…
        </Text>
      ) : null}
      </RevealProvider>
    </Animated.ScrollView>
    <SheetClose />
    </SkyScreen>
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
    <Reveal group style={styles.googleWrap}>
    <Glass style={styles.google}>
      <Reveal>
        <Text variant="eyebrow">On Google</Text>
      </Reveal>
      {info.rating !== null ? (
        <Reveal style={styles.ratingRow}>
          <Text variant="headline" accessibilityLabel={`Rated ${info.rating.toFixed(1)} out of 5`}>
            {info.rating.toFixed(1)}
          </Text>
          <Feather name="star" size={16} color={skyInk.strong} />
          {info.ratingCount !== null ? (
            <Text variant="label" color={skyInk.soft}>
              {info.ratingCount.toLocaleString('en-IN')} {info.ratingCount === 1 ? 'review' : 'reviews'}
            </Text>
          ) : null}
        </Reveal>
      ) : null}
      {facts.length ? (
        <Reveal>
          <Text variant="label" color={skyInk.soft}>
            {facts.join(' · ')}
          </Text>
        </Reveal>
      ) : null}
      {info.summary ? (
        <Reveal>
          <Text variant="body">{info.summary}</Text>
        </Reveal>
      ) : null}
      {info.reviews.map((r) => (
        <Reveal key={`${r.author}-${r.when}`} style={styles.review}>
          <Text variant="label" color={skyInk.soft}>
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
        </Reveal>
      ))}
      <Text variant="label" style={[styles.link, styles.more]} onPress={onOpen} accessibilityRole="link">
        {info.reviews.length ? 'All reviews on Google Maps' : 'See it on Google Maps'}
      </Text>
    </Glass>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  // A 44pt row: the tick and its words both take the tap.
  been: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, alignSelf: 'center', marginTop: 8 },
  googleWrap: { marginTop: 24 },
  google: { padding: space.lg, gap: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  review: { gap: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: skyInk.line },
  link: { color: skyInk.strong, textDecorationLine: 'underline' },
  more: { marginTop: 4 },
  content: { padding: space.screen, paddingTop: 24, paddingBottom: 40 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  action: { flex: 1 },
  note: { marginTop: 12, textAlign: 'center' },
});
