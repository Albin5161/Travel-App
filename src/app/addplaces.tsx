import { Icon } from '@/components/Icon';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import Ionicons from '@/components/Ionicons';
import { PhotoCard } from '@/components/PhotoCard';
import { PressableScale } from '@/components/PressableScale';
import { Glass } from '@/components/sky/Glass';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { Tick } from '@/components/sky/Tick';
import { PlaceSearchSheet } from '@/components/verify/PlaceSearchSheet';
import { getReel } from '@/data/api';
import { register } from '@/data/registry';
import { allDistricts } from '@/data/regions';
import type { Place } from '@/data/types';
import { bestKnownSpots, cityFromWhere, lengthLabel, placeFromPick, sendVerdicts, townOf, type Suggestion } from '@/lib/extract';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { fadeUp } from '@/lib/motion';
import { useTrips } from '@/state/trips';
import { Tone } from '@/theme/tone';
import { skyOnInk, skyFill, skyInk } from '@/theme/sky';
import { colors, fonts, radii, space, textSize } from '@/theme/tokens';

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

  // The city's best-known spots: rows that fill in while they load, each marked as a suggestion.
  const spotList = (
    <Animated.View entering={ENTER[2]} style={styles.list}>
      {spots === 'loading' ? (
        <>
          <Glass radius={radii.pane} style={styles.spots}>
            {[0.62, 0.5, 0.68].map((w, i) => (
              <View key={i} style={styles.spot} accessible={false}>
                <Loading style={styles.thumb} />
                <View style={styles.rowText}>
                  <Loading style={[styles.bar, { width: `${w * 100}%` }]} />
                  <Loading style={[styles.bar, { width: `${w * 60}%` }]} />
                </View>
              </View>
            ))}
          </Glass>
          <Text variant="label" color={skyInk.soft} accessibilityLiveRegion="polite">
            {`Finding ${city}’s best-known spots… about 10 seconds`}
          </Text>
        </>
      ) : Array.isArray(spots) ? (
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
                accessibilityLabel={[place.name, place.area, 'suggested'].filter(Boolean).join(', ')}
              >
                <Image source={place.photo} style={[styles.thumb, !on && styles.thumbOff]} contentFit="cover" transition={0} />
                <View style={styles.rowText}>
                  <View style={styles.nameRow}>
                    <Text variant="bodyStrong" numberOfLines={1} style={styles.nameShrink}>
                      {place.name}
                    </Text>
                    <View style={styles.chip}>
                      <Text variant="label" color={skyInk.soft} style={styles.chipText}>
                        Suggested
                      </Text>
                    </View>
                  </View>
                  <Text variant="label" color={skyInk.soft} numberOfLines={2}>
                    {place.why || place.area}
                  </Text>
                </View>
                <Tick on={on} />
              </Pressable>
            );
          })}
        </Glass>
      ) : null}
    </Animated.View>
  );

  const cardW = W - space.screen * 2;
  return (
    <SkyScreen style={{ paddingTop: insets.top + 8 }}>
      <IconButton icon="x" onPress={close} accessibilityLabel="Close without saving" style={styles.close} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 140 }]}>
        <Animated.View entering={ENTER[0]} style={styles.titles}>
          <Text variant="label" ink="faint">{[instagram ? 'Instagram reel' : 'YouTube video', city].filter(Boolean).join(' · ')}</Text>
          <Text variant="display" accessibilityRole="header">
            {city ? `${city}’s best-known spots` : 'Add the places yourself'}
          </Text>
          {city ? (
            // Said before the list arrives, so suggestions never look like the video's own finds.
            <View style={styles.notice}>
              <Icon name="info" size={16} color={skyInk.strong} />
              <View style={styles.noticeText}>
                <Text variant="label" color={skyInk.strong} style={styles.noticeTitle}>
                  {`The ${instagram ? 'reel' : 'video'} doesn’t name any places.`}
                </Text>
                <Text variant="label" color={skyInk.soft}>
                  {`So here are ${city}’s best-known spots instead, suggested by Xplore’s AI (it can make mistakes). Tick the ones you want, or add places you spot in the ${instagram ? 'reel' : 'video'}.`}
                </Text>
              </View>
            </View>
          ) : (
            <Text variant="body">Watch the reel, then search for each place you spot.</Text>
          )}
        </Animated.View>

        {city && spots ? spotList : null}

        <Animated.View entering={ENTER[1]}>
          <PressableScale onPress={watch} accessibilityRole="link" accessibilityLabel={instagram ? 'Watch the reel on Instagram' : 'Watch the video on YouTube'}>
            <Tone value="dark">
              <PhotoCard source={reel.thumbnail} gradient="pick" style={{ width: cardW, height: cardW * 0.56 }}>
                <View style={styles.reelText}>
                  <View style={styles.sourceRow}>
                    <Ionicons name={instagram ? 'logo-instagram' : 'logo-youtube'} size={14} color={colors.mist} />
                    <Text variant="label" ink="faint" color={colors.mist} numberOfLines={1}>
                      {reel.creator}
                      {lengthLabel(reel) ? ` · ${lengthLabel(reel)}` : ''}
                    </Text>
                  </View>
                  {reel.title ? (
                    <Text variant="bodyStrong" numberOfLines={2}>
                      {reel.title}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.watch}>
                  <Icon name="play" size={14} color={skyOnInk} />
                  <Text variant="label" color={skyOnInk}>
                    {instagram ? 'Watch on Instagram' : 'Watch on YouTube'}
                  </Text>
                </View>
              </PhotoCard>
            </Tone>
          </PressableScale>
        </Animated.View>


        <Animated.View entering={ENTER[2]} style={styles.list}>
          {city && added.some((a) => !Array.isArray(spots) || !spots.some((s) => s.id === a.place.id)) ? (
            <Text variant="label" ink="faint">Added by you</Text>
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

/** A grey block where a row's words and picture will be, breathing gently while the list loads. */
function Loading({ style }: { style: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    glow.set(withRepeat(withTiming(0.45, { duration: 700 }), -1, true));
  }, [glow, reduced]);
  const pulse = useAnimatedStyle(() => ({ opacity: glow.get() }));
  return <Animated.View style={[style, pulse]} />;
}

const styles = StyleSheet.create({
  close: { marginLeft: space.screen },
  body: { paddingHorizontal: space.screen, paddingTop: 20, gap: 24 },
  titles: { gap: 8 },
  reelText: { position: 'absolute', left: 18, right: 18, bottom: 56, gap: 8 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  watch: {
    position: 'absolute',
    left: 18,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: skyInk.strong,
  },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: skyFill.pane },
  thumbOff: { opacity: 0.55 },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radii.pane, backgroundColor: skyFill.pane },
  noticeText: { flex: 1, gap: 2 },
  noticeTitle: { fontFamily: fonts.sansSemi },
  bar: { height: 12, borderRadius: 6, backgroundColor: skyFill.pane },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameShrink: { flexShrink: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, backgroundColor: skyFill.pane },
  chipText: { ...textSize.tag },
  spots: { padding: 8, gap: 2 },
  // A whole row is the tap, at least 44pt tall.
  spot: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 64, borderRadius: radii.pane },
  spotPressed: { backgroundColor: skyFill.pane },
  rowText: { flex: 1, gap: 2 },
  save: { position: 'absolute', left: space.screen, right: space.screen, bottom: 0 },
});
