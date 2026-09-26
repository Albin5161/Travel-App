import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { SavedTick } from '@/components/motion/SavedTick';
import { AmbientBackdrop } from '@/components/pick/AmbientBackdrop';
import { SwipeCard, type CardHandle, type Dir } from '@/components/pick/SwipeCard';
import { Text } from '@/components/Text';
import { PlaceSearchSheet } from '@/components/verify/PlaceSearchSheet';
import { places as catalogPlaces } from '@/data/catalog';
import type { Place } from '@/data/types';
import { CHECK_AS_LIST_FROM, isLiveReel, placeFromPick, sendVerdicts, type Suggestion } from '@/lib/extract';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { FADE_IN, FADE_OUT, fadeUp } from '@/lib/motion';
import { isNearHome, useTrips } from '@/state/trips';
import { colors, light, shadows } from '@/theme/tokens';

const DONE_ENTER = [0, 1, 2, 3].map((i) => fadeUp(i * 60));
const OFFER_IN = fadeUp(0);
// Long enough to read "Removed X · Fix it" and reach for it; short enough not to nag.
const OFFER_MS = 3500;


/**
 * The extraction, checked one card at a time: right if we got it right, left if we didn't. Nothing
 * is saved until the stack runs out, and then only what was confirmed. There is deliberately no
 * "all correct": on the first card it would mean trusting cards nobody has looked at.
 * The swipe lives here rather than in planning because this is where a yes/no is a real question.
 */
export default function Verify() {
  const { state, dispatch } = useTrips();
  // Held for the screen's lifetime: saving (even saving nothing) clears the staged copy in the
  // store, and fixes can still arrive after that.
  const [extraction] = useState(() => state.lastExtraction);
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ id: string; dir: Dir }[]>([]);
  const [returning, setReturning] = useState<Dir | null>(null);
  const topCard = useRef<CardHandle>(null);
  const dragX = useSharedValue(0);

  // A wrong card can be put right (a replacement place) or dismissed (it wasn't a place: null).
  const [fixes, setFixes] = useState<Record<string, Place | null>>({});
  // Places the video mentioned but the extraction missed, added by hand.
  const [extras, setExtras] = useState<Place[]>([]);
  const [sheet, setSheet] = useState<{ wrong: Place | null } | null>(null);
  // The undo-style offer after a left swipe: fix it now, or let it go.
  const [offer, setOffer] = useState<Place | null>(null);

  const places = useMemo(() => extraction?.places ?? [], [extraction]);
  const done = index >= places.length;
  const listMode = places.length >= CHECK_AS_LIST_FROM;
  // In the list, every place starts ticked; these are the ones untaken.
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
  const wrong = places.filter((p) => history.some((h) => h.id === p.id && h.dir === 'skip'));
  const saved = uniq([
    ...places.filter((p) => !wrong.includes(p)),
    ...Object.values(fixes).filter((p): p is Place => !!p),
    ...extras,
  ]);
  // What the search can offer: other places we know in this city. Never one from this video:
  // those have already been answered, and a mis-swipe is what undo is for.
  const candidates = useMemo(
    () =>
      Object.values(catalogPlaces).filter(
        (p) => p.cityId === extraction?.city.id && !places.some((q) => q.id === p.id),
      ),
    [extraction, places],
  ).filter((p) => !saved.some((s) => s.id === p.id));

  // Save once, the moment the checking is over, so the card is already on Home when we get back.
  // Fixes and additions made on the saved screen are added one by one after that.
  const committed = useRef(false);
  useEffect(() => {
    if (!done || !extraction || committed.current) return;
    committed.current = true;
    dispatch({ type: 'commitExtraction', extraction, placeIds: saved.map((p) => p.id) });
    track('places saved', { count: saved.length, wrong: wrong.length, from: 'video' });
    sendVerdicts(
      extraction.reel,
      places.map((place) => ({ place, verdict: wrong.includes(place) ? 'wrong' : 'right' })),
    );
    if (saved.length > 0) haptic.success();
  }, [dispatch, done, extraction, saved, places, wrong]);

  useEffect(() => {
    if (!offer) return;
    const t = setTimeout(() => setOffer(null), OFFER_MS);
    return () => clearTimeout(t);
  }, [offer]);

  const add = (place: Place) => {
    if (!extraction) return;
    haptic.success();
    if (sheet?.wrong) setFixes((f) => ({ ...f, [sheet.wrong!.id]: place }));
    else setExtras((e) => [...e, place]);
    if (committed.current) dispatch({ type: 'commitExtraction', extraction, placeIds: [place.id] });
    sendVerdicts(extraction.reel, [{ place, verdict: 'added' }]);
    setSheet(null);
  };

  // Arriving here with nothing to check (a reload, say) goes home rather than showing an empty stack.
  useEffect(() => {
    if (!extraction) router.replace('/');
  }, [extraction]);

  if (!extraction) return null;
  const { city, reel } = extraction;
  // A real link searches Google, leaning toward where its places are; the samples search the catalog.
  const live = isLiveReel(reel)
    ? {
        near: centreOf(places),
        resolve: (s: Suggestion, session: string) =>
          placeFromPick(s, session, { cityId: city.id, reel, others: [...places, ...extras] }),
      }
    : undefined;

  const commit = (place: Place, dir: Dir) => {
    haptic.light();
    dragX.set(0);
    setHistory((h) => [...h, { id: place.id, dir }]);
    setReturning(null);
    // A left swipe mid-stack offers the fix without stopping the rhythm. The last card doesn't:
    // the saved screen lists every left-out place with its own Fix.
    setOffer(dir === 'skip' && index < places.length - 1 ? place : null);
    setIndex((i) => i + 1);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    haptic.selection();
    dragX.set(0);
    setHistory((h) => h.slice(0, -1));
    setOffer(null);
    setReturning(last.dir);
    setIndex((i) => i - 1);
  };

  // Saving the list is the same as swiping through it: ticked is right, unticked is wrong.
  const saveList = () => {
    haptic.light();
    setHistory(places.map((p) => ({ id: p.id, dir: unticked.has(p.id) ? 'skip' : 'keep' })));
    setIndex(places.length);
  };

  const cardW = W - 40;
  const cardH = Math.min(H - insets.top - insets.bottom - 250, 580);
  const visible = places.slice(index, index + 3);

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 8 }]}>
      {!done && !listMode ? <AmbientBackdrop current={places[index]} next={places[index + 1]} x={dragX} width={W} /> : null}
      <View style={styles.header}>
        <IconButton
          icon="x"
          onPress={() => router.back()}
          accessibilityLabel={done ? 'Close' : 'Stop checking. Nothing is saved.'}
        />
        {!done && !listMode ? (
          <View style={styles.headerRight}>
            <Animated.View key={index} entering={FADE_IN}>
              <Text variant="data">
                {index + 1} of {places.length}
              </Text>
            </Animated.View>
            {history.length > 0 ? (
              <Animated.View entering={FADE_IN} exiting={FADE_OUT}>
                <IconButton icon="rotate-ccw" onPress={undo} accessibilityLabel="Undo last answer" />
              </Animated.View>
            ) : null}
          </View>
        ) : null}
      </View>

      {done ? (
        <Done
          count={saved.length}
          city={city.name}
          near={isNearHome(city.id, state.homeDistrictId)}
          left={wrong}
          fixes={fixes}
          onFix={(p) => setSheet({ wrong: p })}
          onAdd={() => setSheet({ wrong: null })}
          bottomInset={insets.bottom}
        />
      ) : listMode ? (
        <CheckList
          places={[...places, ...extras]}
          extras={extras}
          creator={reel.creator}
          city={city.name}
          platform={reel.platform}
          unticked={unticked}
          onToggle={(id) => {
            haptic.selection();
            setUnticked((u) => {
              const next = new Set(u);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onAdd={() => setSheet({ wrong: null })}
          onSave={saveList}
          bottomInset={insets.bottom}
        />
      ) : (
        <>
          <View style={styles.titleBlock}>
            <View style={styles.source}>
              <Ionicons
                name={reel.platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'}
                size={13}
                color={light.inkFaint}
              />
              <Text variant="micro">
                {reel.creator} · {city.name}
              </Text>
            </View>
            <Text variant="display">Did we get it right?</Text>
          </View>
          <View style={[styles.stack, { height: cardH + 30 }]}>
            {visible
              .map((place, i) => (
                <SwipeCard
                  key={place.id}
                  ref={i === 0 ? topCard : undefined}
                  place={place}
                  depth={i}
                  width={cardW}
                  height={cardH}
                  screenW={W}
                  enterFrom={i === 0 ? returning : null}
                  fresh={i === 2 && index > 0}
                  dragX={dragX}
                  labels={{ keep: 'Right', skip: 'Wrong' }}
                  onCommit={(dir) => commit(place, dir)}
                />
              ))
              .reverse()}
          </View>
          <View style={[styles.actions, { paddingBottom: insets.bottom + 8 }]}>
            {offer ? (
              <Animated.View key={offer.id} entering={OFFER_IN} exiting={FADE_OUT} style={styles.offer}>
                <Text variant="label" color={colors.mist} numberOfLines={1} style={styles.offerText}>
                  Removed {offer.name}
                </Text>
                <Pressable
                  onPress={() => {
                    haptic.selection();
                    setOffer(null);
                    setSheet({ wrong: offer });
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Fix ${offer.name}`}
                >
                  <Text variant="label" color={light.photoInk} style={styles.offerAction}>
                    Fix it
                  </Text>
                </Pressable>
              </Animated.View>
            ) : null}
            <View style={styles.actionRow}>
              <Button kind="secondary" label="Wrong" onPress={() => topCard.current?.swipe('skip')} style={styles.action} />
              <Button label="Right" onPress={() => topCard.current?.swipe('keep')} style={styles.action} />
            </View>
          </View>
        </>
      )}
      <PlaceSearchSheet
        visible={!!sheet}
        wrong={sheet?.wrong}
        cityName={city.name}
        candidates={candidates}
        live={live}
        onPick={add}
        onNotAPlace={() => {
          if (sheet?.wrong) setFixes((f) => ({ ...f, [sheet.wrong!.id]: null }));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

/**
 * Six or more places, checked as one list: all ticked, untick the ones that aren't right, save once.
 * Places added with "Missed one?" join the list ticked. Nothing is saved until Save, as with cards.
 */
function CheckList({
  places,
  extras,
  creator,
  city,
  platform,
  unticked,
  onToggle,
  onAdd,
  onSave,
  bottomInset,
}: {
  places: Place[];
  extras: Place[];
  creator: string;
  city: string;
  platform: 'youtube' | 'instagram';
  unticked: Set<string>;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onSave: () => void;
  bottomInset: number;
}) {
  // Added places can't be unticked here: adding one was the answer. They're saved with the rest.
  const ticked = places.filter((p) => extras.includes(p) || !unticked.has(p.id)).length;
  return (
    <View style={styles.list}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 110 }} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <View style={styles.source}>
            <Ionicons name={platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'} size={13} color={light.inkFaint} />
            <Text variant="micro" numberOfLines={1}>
              {creator} · {city}
            </Text>
          </View>
          <Text variant="display">Did we get these right?</Text>
          <Text variant="body" color={light.inkSoft}>
            {`We found ${places.length - extras.length} places. Untick any that are wrong.`}
          </Text>
        </View>
        <View style={styles.rows}>
          {places.map((p) => {
            const added = extras.includes(p);
            const on = added || !unticked.has(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => !added && onToggle(p.id)}
                style={({ pressed }) => [styles.row, pressed && !added && styles.rowPressed]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: added }}
                accessibilityLabel={`${p.name}, ${p.area || city}`}
              >
                <Image source={p.photo} style={[styles.thumb, !on && styles.thumbOff]} contentFit="cover" transition={0} />
                <View style={styles.rowText}>
                  <Text variant="bodyStrong" numberOfLines={1} color={on ? light.ink : light.inkFaint}>
                    {p.name}
                  </Text>
                  <Text variant="label" color={light.inkSoft} numberOfLines={1}>
                    {added ? 'Added by you' : [TYPE[p.type], p.area].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Feather name="check" size={14} color={light.ctaInk} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Button kind="text" label="Missed one? Add a place" onPress={onAdd} />
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: bottomInset + 8 }]}>
        <Button
          label={ticked === 0 ? 'Tick at least one place' : `Save ${ticked} ${ticked === 1 ? 'place' : 'places'}`}
          onPress={onSave}
          disabled={ticked === 0}
        />
      </View>
    </View>
  );
}

const TYPE: Record<Place['type'], string> = { food: 'Food', stay: 'Stay', sight: 'Sight', experience: 'Experience' };

/** The middle of a set of places, to lean a search toward; null when there are none. */
function centreOf(list: Place[]) {
  if (list.length === 0) return null;
  return {
    lat: list.reduce((sum, p) => sum + p.coords.lat, 0) / list.length,
    lng: list.reduce((sum, p) => sum + p.coords.lng, 0) / list.length,
  };
}

function uniq(list: Place[]) {
  return list.filter((p, i) => list.findIndex((q) => q.id === p.id) === i);
}

function Done({
  count,
  city,
  near,
  left,
  fixes,
  onFix,
  onAdd,
  bottomInset,
}: {
  count: number;
  city: string;
  near: boolean;
  left: Place[];
  fixes: Record<string, Place | null>;
  onFix: (place: Place) => void;
  onAdd: () => void;
  bottomInset: number;
}) {
  const where = near ? 'Near Home' : 'Cities';
  return (
    <View style={[styles.done, { paddingBottom: bottomInset + 16 }]}>
      <View style={{ flex: 1 }} />
      {count > 0 ? (
        <Animated.View entering={DONE_ENTER[0]} style={styles.tick}>
          <SavedTick size={64} />
        </Animated.View>
      ) : null}
      <Animated.View entering={DONE_ENTER[1]}>
        <Text variant="display" style={styles.center}>
          {count === 0 ? 'Nothing saved.' : `${count} ${count === 1 ? 'place' : 'places'} saved.`}
        </Text>
      </Animated.View>
      <Animated.View entering={DONE_ENTER[2]}>
        <Text variant="body" style={styles.center}>
          {count === 0 ? "None of them were right. That one's on us." : `Find ${city} under ${where}.`}
        </Text>
      </Animated.View>

      {left.length > 0 ? (
        <Animated.View entering={DONE_ENTER[3]} style={styles.leftOut}>
          <Text variant="micro">Left out</Text>
          {left.map((p) => {
            const fix = fixes[p.id];
            return (
              <View key={p.id} style={styles.leftRow}>
                <View style={styles.leftText}>
                  <Text variant="bodyStrong" numberOfLines={1} style={fix !== undefined && styles.struck}>
                    {p.name}
                  </Text>
                  {fix ? (
                    <Text variant="label" color={light.inkSoft} numberOfLines={1}>
                      Saved {fix.name} instead
                    </Text>
                  ) : fix === null ? (
                    <Text variant="label" color={light.inkSoft}>
                      Not a place
                    </Text>
                  ) : null}
                </View>
                {fix === undefined ? (
                  <Pressable onPress={() => onFix(p)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Fix ${p.name}`}>
                    <Text variant="label" style={styles.link}>
                      Fix
                    </Text>
                  </Pressable>
                ) : (
                  <Feather name="check" size={16} color={light.inkSoft} />
                )}
              </View>
            );
          })}
        </Animated.View>
      ) : null}

      <View style={{ flex: 1 }} />
      <Animated.View entering={DONE_ENTER[3]} style={styles.doneActions}>
        <Button kind="text" label="Missed one? Add a place" onPress={onAdd} />
        <Button label={count === 0 ? 'Back home' : 'Done'} onPress={() => router.back()} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleBlock: { paddingHorizontal: 24, marginTop: 8, gap: 6 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack: { marginTop: 16, alignItems: 'center' },
  actions: { position: 'absolute', left: 20, right: 20, bottom: 0 },
  actionRow: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
  done: { flex: 1, paddingHorizontal: 24, gap: 12 },
  tick: { alignItems: 'center', marginBottom: 8 },
  center: { textAlign: 'center' },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'center',
    marginBottom: 12,
    paddingLeft: 16,
    paddingRight: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: light.ink,
    boxShadow: shadows.cta,
    maxWidth: '100%',
  },
  offerText: { flexShrink: 1 },
  offerAction: { textDecorationLine: 'underline' },
  leftOut: {
    marginTop: 20,
    padding: 16,
    gap: 10,
    borderRadius: 20,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
  },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leftText: { flex: 1, gap: 2 },
  struck: { textDecorationLine: 'line-through', color: light.inkFaint },
  link: { textDecorationLine: 'underline' },
  doneActions: { gap: 4 },
  list: { flex: 1 },
  rows: { marginTop: 20, marginBottom: 8, paddingHorizontal: 16, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 16 },
  rowPressed: { backgroundColor: light.line },
  thumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: light.canvasTop },
  thumbOff: { opacity: 0.35 },
  rowText: { flex: 1, gap: 2 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: light.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: light.ink, borderColor: light.ink },
});
