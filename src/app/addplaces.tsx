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
import { Tick } from '@/components/sky/Tick';
import { PlaceSearchSheet } from '@/components/verify/PlaceSearchSheet';
import { getReel } from '@/data/api';
import { register } from '@/data/registry';
import { allDistricts } from '@/data/regions';
import type { Place } from '@/data/types';
import { bestKnownSpots, cityFromWhere, placeFromPick, sendVerdicts, townOf, type Suggestion } from '@/lib/extract';
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
 * first place is. A video about a city that named no places in it (`region`) also lists the city's
 * best-known spots to tick, marked as suggestions rather than places from the video.
 */
export default function AddPlaces() {
  const { reel: reelId, url, region } = useLocalSearchParams<{ reel: string; url: string; region?: string }>();
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
  const city = region?.split(',')[0]?.trim() || null;
  // The city's best-known spots: loading, the list, or none (couldn't be fetched, or no city).
  const [spots, setSpots] = useState<Place[] | 'loading' | null>(region && reel ? 'loading' : null);
  useEffect(() => {
    if (!region || !reel) return;
    let live = true;
    bestKnownSpots(region, reel)
      .then((found) => live && setSpots(found.length ? found : null))
      .catch(() => live && setSpots(null));
    return () => {
      live = false;
    };
    // The reel is looked up by id; once is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, reelId]);

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

  const toggleSpot = (place: Place) => {
    haptic.selection();
    setAdded((list) =>
      list.some((a) => a.place.id === place.id)
        ? list.filter((a) => a.place.id !== place.id)
        : [...list, { place, where: region ?? '' }],
    );
  };

  const save = () => {
    if (added.length === 0) return;
    haptic.success();
    const saving = cityFromWhere(added[0].where, reel, places);
    // Picked spots and searched places can be filed under slightly different town names; all of
    // them go in the one city they're saved as.
    const kept = places.map((p) => ({ ...p, cityId: saving.id }));
    const saved = { ...reel, cityId: saving.id, placeIds: kept.map((p) => p.id) };
    register({ city: saving, reel: saved, places: kept });
    dispatch({ type: 'commitExtraction', extraction: { reel: saved, city: saving, places: kept } });
    const picked = kept.filter((p) => Array.isArray(spots) && spots.some((s) => s.id === p.id)).length;
    track('places saved', { count: kept.length, wrong: 0, from: picked ? 'city spots' : 'by hand', picked });
    sendVerdicts(saved, kept.map((place) => ({ place, verdict: 'added' as const })));
    router.replace('/');
  };
  const instagram = reel.platform === 'instagram';

  const cardW = W - space.screen * 2;
  return (
    <SkyScreen style={{ paddingTop: insets.top + 8 }}>
      <IconButton icon="x" onPress={close} accessibilityLabel="Close without saving" style={styles.close} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 140 }]}>
        <Animated.View entering={ENTER[0]} style={styles.titles}>
          <Text variant="eyebrow">{[instagram ? 'Instagram reel' : 'YouTube video', city].filter(Boolean).join(' · ')}</Text>
          <Text variant="display" accessibilityRole="header">
            {city ? `Your ${city} spots` : 'Add the places yourself'}
          </Text>
          <Text variant="body">
            {city
              ? `Tick ${city}’s best-known spots you want, or watch the ${instagram ? 'reel' : 'video'} and search for the places you spot.`
              : 'Watch the reel, then search for each place you spot.'}
          </Text>
        </Animated.View>

        <Animated.View entering={ENTER[1]}>
          <Pressable onPress={watch} accessibilityRole="link" accessibilityLabel={instagram ? 'Watch the reel on Instagram' : 'Watch the video on YouTube'}>
            <Tone value="dark">
              <PhotoCard source={reel.thumbnail} gradient="pick" style={{ width: cardW, height: cardW * 0.56 }}>
                <View style={styles.reelText}>
                  <View style={styles.sourceRow}>
                    <Ionicons name={instagram ? 'logo-instagram' : 'logo-youtube'} size={14} color={colors.mist} />
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
                    {instagram ? 'Watch on Instagram' : 'Watch on YouTube'}
                  </Text>
                </View>
              </PhotoCard>
            </Tone>
          </Pressable>
        </Animated.View>

        {spots ? (
          <Animated.View entering={ENTER[2]} style={styles.list}>
            <View style={styles.spotsHead}>
              <Text variant="eyebrow" accessibilityRole="header">
                Well known in {city}
              </Text>
              <Text variant="label" color={skyInk.soft}>
                Suggested by Xplore’s AI, not seen in the {instagram ? 'reel' : 'video'}. It can make mistakes.
              </Text>
            </View>
            {spots === 'loading' ? (
              <Glass radius={radii.pane} style={styles.row}>
                <Text variant="label" color={skyInk.soft}>
                  Finding {city}’s best-known spots…
                </Text>
              </Glass>
            ) : (
              <Glass radius={radii.pane} style={styles.spots}>
                {spots.map((place) => {
                  const on = added.some((a) => a.place.id === place.id);
                  return (
                    <Pressable
                      key={place.id}
                      onPress={() => toggleSpot(place)}
                      style={({ pressed }) => [styles.spot, pressed && styles.spotPressed]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={[place.name, place.area].filter(Boolean).join(', ')}
                    >
                      <Image source={place.photo} style={[styles.thumb, !on && styles.thumbOff]} contentFit="cover" transition={0} />
                      <View style={styles.rowText}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {place.name}
                        </Text>
                        <Text variant="label" color={skyInk.soft} numberOfLines={2}>
                          {place.why || place.area}
                        </Text>
                      </View>
                      <Tick on={on} />
                    </Pressable>
                  );
                })}
              </Glass>
            )}
          </Animated.View>
        ) : null}

        <Animated.View entering={ENTER[2]} style={styles.list}>
          {city && added.some((a) => !Array.isArray(spots) || !spots.some((s) => s.id === a.place.id)) ? (
            <Text variant="eyebrow">Added by you</Text>
          ) : null}
          {added
            .filter((a) => !Array.isArray(spots) || !spots.some((s) => s.id === a.place.id))
            .map(({ place, where }) => (
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
  thumbOff: { opacity: 0.55 },
  spotsHead: { gap: 4 },
  spots: { padding: 6, gap: 2 },
  // A whole row is the tap, at least 44pt tall.
  spot: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 64, borderRadius: radii.pane },
  spotPressed: { backgroundColor: skyFill.pane },
  rowText: { flex: 1, gap: 2 },
  save: { position: 'absolute', left: space.screen, right: space.screen, bottom: 0 },
});
