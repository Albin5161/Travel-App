import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import Ionicons from '@/components/Ionicons';
import { PhotoCard } from '@/components/PhotoCard';
import { Glass } from '@/components/sky/Glass';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { PlaceSearchSheet } from '@/components/verify/PlaceSearchSheet';
import { getReel } from '@/data/api';
import { register } from '@/data/registry';
import { allDistricts } from '@/data/regions';
import type { Place } from '@/data/types';
import { cityFromWhere, placeFromPick, sendVerdicts, townOf, type Suggestion } from '@/lib/extract';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { fadeUp } from '@/lib/motion';
import { useTrips } from '@/state/trips';
import { Tone } from '@/theme/tone';
import { skyCta, skyFill, skyInk } from '@/theme/sky';
import { colors, radii, space } from '@/theme/tokens';

const ENTER = [0, 1, 2].map((i) => fadeUp(i * 60));

/**
 * A reel we couldn't read for places, saved anyway: the person watches it on Instagram and searches
 * for each place they spot. Nothing is saved until they tap Save; the city is named after where the
 * first place is.
 */
export default function AddPlaces() {
  const { reel: reelId, url } = useLocalSearchParams<{ reel: string; url: string }>();
  const reel = getReel(reelId);
  const { state, dispatch } = useTrips();
  // Until a place is added there's nothing to lean the search toward but home: most reels people
  // save are of places they might go, and home is the best guess we have.
  const home = allDistricts.find((d) => d.id === state.homeDistrictId)?.centre ?? null;
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [added, setAdded] = useState<{ place: Place; where: string }[]>([]);
  const [searching, setSearching] = useState(false);
  // Where each picked place is ("Kottayam, Kerala, India"), for naming the city it's saved in.
  const whereOf = useRef(new Map<string, string>());

  // A reload loses what we knew of the reel; start again from Home.
  useEffect(() => {
    if (!reel) router.replace('/');
  }, [reel]);
  if (!reel) return null;

  const places = added.map((a) => a.place);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const watch = () => {
    haptic.light();
    void Linking.openURL(url);
  };

  const resolve = async (s: Suggestion, session: string) => {
    const place = await placeFromPick(s, session, {
      // Every place goes in the first one's town, so they're saved and planned together.
      cityId: townOf(added[0]?.where ?? s.where).id,
      reel,
      others: places,
    });
    if (place) whereOf.current.set(place.id, s.where);
    return place;
  };

  const pick = (place: Place) => {
    haptic.success();
    const where = whereOf.current.get(place.id) ?? '';
    setAdded((list) => (list.some((a) => a.place.id === place.id) ? list : [...list, { place, where }]));
    setSearching(false);
  };

  const save = () => {
    if (added.length === 0) return;
    haptic.success();
    const city = cityFromWhere(added[0].where, reel, places);
    const saved = { ...reel, cityId: city.id, placeIds: places.map((p) => p.id) };
    register({ city, reel: saved });
    dispatch({ type: 'commitExtraction', extraction: { reel: saved, city, places } });
    track('places saved', { count: places.length, wrong: 0, from: 'by hand' });
    sendVerdicts(saved, places.map((place) => ({ place, verdict: 'added' as const })));
    router.replace('/');
  };

  const cardW = W - space.screen * 2;
  return (
    <SkyScreen style={{ paddingTop: insets.top + 8 }}>
      <IconButton icon="x" onPress={close} accessibilityLabel="Close without saving" style={styles.close} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 140 }]}>
        <Animated.View entering={ENTER[0]} style={styles.titles}>
          <Text variant="eyebrow">Instagram reel</Text>
          <Text variant="display" accessibilityRole="header">
            Add the places yourself
          </Text>
          <Text variant="body">
            Watch the reel, then search for each place you spot.
          </Text>
        </Animated.View>

        <Animated.View entering={ENTER[1]}>
          <Pressable onPress={watch} accessibilityRole="link" accessibilityLabel="Watch the reel on Instagram">
            <Tone value="dark">
              <PhotoCard source={reel.thumbnail} style={{ width: cardW, height: cardW * 0.56 }}>
                <View style={styles.reelText}>
                  <View style={styles.sourceRow}>
                    <Ionicons name="logo-instagram" size={14} color={colors.mist} />
                    <Text variant="micro" color={colors.mist} numberOfLines={1}>
                      {reel.creator}
                      {reel.duration ? ` · ${reel.duration}` : ''}
                    </Text>
                  </View>
                  {reel.title ? (
                    <Text variant="bodyStrong" numberOfLines={2}>
                      {reel.title}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.watch}>
                  <Feather name="play" size={14} color={skyCta} />
                  <Text variant="label" color={skyCta}>
                    Watch on Instagram
                  </Text>
                </View>
              </PhotoCard>
            </Tone>
          </Pressable>
        </Animated.View>

        <Animated.View entering={ENTER[2]} style={styles.list}>
          {added.map(({ place, where }) => (
            <Glass key={place.id} radius={radii.pane} style={styles.row}>
              <Image source={place.photo} style={styles.thumb} contentFit="cover" transition={0} />
              <View style={styles.rowText}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {place.name}
                </Text>
                <Text variant="label" color={skyInk.soft} numberOfLines={1}>
                  {where}
                </Text>
                {place.photoCredit ? (
                  <Text variant="label" color={skyInk.faint} numberOfLines={1}>
                    Photo: {place.photoCredit}
                  </Text>
                ) : null}
              </View>
              <IconButton
                icon="x"
                onPress={() => setAdded((list) => list.filter((a) => a.place.id !== place.id))}
                accessibilityLabel={`Remove ${place.name}`}
              />
            </Glass>
          ))}
          <Button kind="secondary" label={added.length ? 'Add another place' : 'Add a place'} onPress={() => setSearching(true)} />
        </Animated.View>
      </ScrollView>

      <View style={[styles.save, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          trailingArrow={added.length > 0}
          label={added.length === 0 ? 'Save' : `Save ${added.length} ${added.length === 1 ? 'place' : 'places'}`}
          onPress={save}
          disabled={added.length === 0}
        />
      </View>

      <PlaceSearchSheet
        visible={searching}
        cityName={added[0] ? townOf(added[0].where).name : 'this trip'}
        candidates={[]}
        live={{ near: places[0]?.coords ?? home, resolve }}
        onPick={pick}
        onClose={() => setSearching(false)}
      />
    </SkyScreen>
  );
}

const styles = StyleSheet.create({
  close: { marginLeft: space.screen },
  body: { paddingHorizontal: space.screen, paddingTop: 20, gap: 24 },
  titles: { gap: 8 },
  reelText: { position: 'absolute', left: 18, right: 18, bottom: 56, gap: 6 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  watch: {
    position: 'absolute',
    left: 18,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: skyInk.strong,
  },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: skyFill.pane },
  rowText: { flex: 1, gap: 2 },
  save: { position: 'absolute', left: space.screen, right: space.screen, bottom: 0 },
});
