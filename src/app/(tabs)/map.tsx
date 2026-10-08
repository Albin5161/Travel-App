import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { css, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/Button';
import { GoogleMap } from '@/components/GoogleMap';
import { HomePicker } from '@/components/HomePicker';
import { PressableScale } from '@/components/PressableScale';
import { Glass } from '@/components/sky/Glass';
import { SkyScreen, useScreenSky } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { ArrivalBanner } from '@/components/spots/ArrivalBanner';
import { Chips } from '@/components/spots/Chips';
import { SpotRow } from '@/components/spots/SpotRow';
import { WeekendRouteCard } from '@/components/spots/WeekendRouteCard';
import { getCity, getReel } from '@/data/api';
import { getDistrict } from '@/data/regions';
import type { Place } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { DURATION, FADE_IN, fadeUp, project, SPRING_DRAG } from '@/lib/motion';
import { KIND_LABEL, clusterSpots, DAY_TRIP_MINUTES, driveMinutes, kmAway, matchesKind, weekendRoutes, type SpotKind } from '@/lib/spots';
import { useArrivalTargets, useSpotStatus, useSpotsByDistrict, useTrips } from '@/state/trips';
import { useWhereIAm } from '@/state/where';
import { deepGlass, skyFill, skyInk, skyVeil } from '@/theme/sky';
import { Tone } from '@/theme/tone';
import { radii, space } from '@/theme/tokens';

const KINDS: SpotKind[] = ['all', 'food', 'sight', 'experience'];
const GUTTER = space.screen;
// The list is a sheet over the map with three places to rest: low (the map has the screen, the
// filters stay in reach), half (enough to see where everything is, and the list), and tall (the list
// has the screen). It opens at half. Pull the handle, or tap it to step through them.
const PANEL_RATIO = 0.5;
/** What shows of the low sheet above the tab bar: the handle and the row of filters. */
const LOW_ABOVE_TABS = 78;
/** The tab bar's room at the foot of the screen, over the safe area. */
const TAB_BAR = 92;
/** How far the sheet gives when pulled past its tallest or lowest place. */
const GIVE = 50;
type Rest = 0 | 1 | 2;
/** A full day out, door to door. The reach chips do the real narrowing. */
const DAY_BUDGET = 600;

export default function SpotsMap() {
  const { district: districtParam } = useLocalSearchParams<{ district?: string }>();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const groups = useSpotsByDistrict();
  const targets = useArrivalTargets();
  const { statusOf } = useSpotStatus();
  const where = useWhereIAm();

  // One filter, what kind of place. Near home and away are both listed, near home first, and every
  // row says how far it is: no separate switches for scope or distance.
  const [kind, setKind] = useState<SpotKind>('all');
  const [pickingHome, setPickingHome] = useState(false);
  // Which headings are open. Until one is tapped, only the first is (or the district an arrival
  // notification points at): a long list starts as a short list of headings.
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  const homeGroups = groups.filter((g) => g.isHome);
  const awayGroups = groups.filter((g) => !g.isHome);
  const homeSpots = homeGroups.flatMap((g) => g.spots);

  // A tapped arrival notification lands here, on that district: everything shows, it comes first.
  const jumped = useRef<string | null>(null);
  useEffect(() => {
    if (!districtParam || jumped.current === districtParam) return;
    jumped.current = districtParam;
    setKind('all');
  }, [districtParam]);

  const visible = useMemo(() => groups.flatMap((g) => g.spots).filter((p) => matchesKind(p, kind)), [groups, kind]);

  // Google's map on the web and on phones alike: every spot has a place on it, wherever it is.
  const pins = useMemo(
    () => visible.map((p) => ({ id: p.id, name: p.name, coords: p.coords, photo: p.photo, been: statusOf(p.id) === 'been' })),
    [visible, statusOf],
  );

  // The sheet is as tall as its tallest place and slid down to the others, so moving it is a
  // transform and never a new layout. `down[r]` is how far it's slid at rest `r`.
  const tallH = Math.round(H - insets.top - 64);
  const shown = [insets.bottom + TAB_BAR + LOW_ABOVE_TABS, Math.round(H * PANEL_RATIO), tallH];
  const down = shown.map((h) => tallH - h);
  const [rest, setRest] = useState<Rest>(1);
  const slide = useSharedValue(down[1]);
  const from = useSharedValue(0);
  const step = () => {
    const to = ((rest + 1) % 3) as Rest;
    haptic.selection();
    slide.set(withSpring(down[to], SPRING_DRAG));
    setRest(to);
  };
  // The screen turned or resized: the sheet stays at the place it was resting.
  useEffect(() => {
    slide.set(down[rest]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [down[0], down[1]]);
  const pull = Gesture.Pan()
    .hitSlop({ top: 10, bottom: 6 })
    .onStart(() => {
      from.set(slide.get());
    })
    .onUpdate((e) => {
      const y = from.get() + e.translationY;
      // Past either end it gives less the further it goes, rather than stopping dead.
      const over = y < 0 ? y : y > down[0] ? y - down[0] : 0;
      slide.set(over === 0 ? y : (y < 0 ? 0 : down[0]) + over / (1 + Math.abs(over) / GIVE));
    })
    .onEnd((e) => {
      // Where the pull would come to rest: a flick moves it a place as surely as a long drag.
      const landing = slide.get() + project(e.velocityY);
      let to: Rest = 0;
      for (let r = 1; r < 3; r++) if (Math.abs(down[r] - landing) < Math.abs(down[to] - landing)) to = r as Rest;
      slide.set(withSpring(down[to], { ...SPRING_DRAG, velocity: e.velocityY }));
      scheduleOnRN(setRest, to);
    });
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: slide.get() }] }));
  // The map keeps its places clear of the sheet at low and half; at tall there's no map to fit.
  const panelH = shown[Math.min(rest, 1)];

  const arrived = state.arrivedDistrictId;
  const arrivedTarget = targets.find((t) => t.districtId === arrived);
  const totalSaved = groups.reduce((n, g) => n + g.spots.length, 0);

  if (totalSaved === 0) return <EmptySpots />;

  const focus = arrived ?? districtParam ?? null;
  const showHome = homeSpots.length > 0;
  const isOpen = (id: string, byDefault: boolean) => opened[id] ?? byDefault;
  const toggle = (id: string, byDefault: boolean) => setOpened((o) => ({ ...o, [id]: !(o[id] ?? byDefault) }));
  // Away from home, the first city is open when there's nothing near home above it; with a
  // district in focus, AwayScope puts that one first.
  const awayDefault = (_name: string, first: boolean) => first && (!showHome || !where.at || !!focus);

  return (
    <SkyScreen>
      {/* The map is paper: its labels keep the paper palette. */}
      <Tone value="light">
      <GoogleMap
        pins={pins}
        width={W}
        height={H}
        padding={{ top: insets.top + 80, bottom: panelH + 24, left: 40, right: 40 }}
        focusId={null}
        onPinPress={(id) => router.push({ pathname: '/place/[id]', params: { id } })}
      />
      </Tone>

      <LinearGradient
        pointerEvents="none"
        colors={[skyVeil(0.8), skyVeil(0.55), skyVeil(0)]}
        locations={[0, 0.55, 1]}
        style={[styles.topFade, { height: insets.top + 120 }]}
      />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text variant="display" accessibilityRole="header">
          Your map
        </Text>
        {where.at ? (
          <View style={styles.wherePill}>
            <Feather
              name={where.source === 'device' ? 'navigation' : 'home'}
              size={12}
              color={skyInk.soft}
            />
            <Text variant="data" numberOfLines={1}>
              {where.label}
            </Text>
          </View>
        ) : (
          // No home and no position: nothing to measure from, so ask rather than guess.
          <PressableScale onPress={() => setPickingHome(true)} style={styles.setHome} accessibilityRole="button" accessibilityLabel="Set your home">
            <View style={styles.wherePill}>
              <Feather name="home" size={12} color={skyInk.strong} />
              <Text variant="data" color={skyInk.strong} numberOfLines={1}>
                {where.label}
              </Text>
            </View>
          </PressableScale>
        )}
      </View>
      <HomePicker visible={pickingHome} onClose={() => setPickingHome(false)} />

      {/* The paper map is light, so the panel over it is deep glass: white type stays readable. */}
      <Animated.View style={[styles.panel, { height: tallH }, sheet]}>
      <DeepPanel style={styles.panelGlass}>
        <GestureDetector gesture={pull}>
          <PressableScale
            onPress={step}
            pressedScale={1}
            hitSlop={0}
            style={styles.handle}
            accessibilityRole="button"
            accessibilityLabel={rest === 2 ? 'Lower the list' : 'Raise the list'}
            accessibilityHint="Pull up or down to resize the list over the map"
          >
            <View style={styles.grabber} />
          </PressableScale>
        </GestureDetector>
        <ScrollView
          showsVerticalScrollIndicator={false}
          // The part of the sheet slid off the foot of the screen is given back as room to scroll.
          contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR + down[rest], paddingTop: 0 }}
        >
          {arrived && arrivedTarget ? (
            <View style={styles.block}>
              <ArrivalBanner
                district={arrivedTarget.name}
                spots={arrivedTarget.spots}
                topArea={arrivedTarget.topArea}
                onSee={() => {
                  setKind('all');
                  dispatch({ type: 'clearArrival' });
                }}
                onDismiss={() => dispatch({ type: 'clearArrival' })}
              />
            </View>
          ) : null}

          <View style={styles.chips}>
            <Chips
              value={kind}
              onChange={setKind}
              options={KINDS.map((k) => ({ key: k, label: KIND_LABEL[k] }))}
              lead={
                // Search leads the filters: another way of narrowing the same list.
                <PressableScale
                  onPress={() => router.push('/search')}
                  style={styles.searchHit}
                  accessibilityRole="button"
                  accessibilityLabel="Search your saved places"
                >
                  <View style={styles.searchChip}>
                    <Feather name="search" size={15} color={skyInk.strong} />
                  </View>
                </PressableScale>
              }
            />
          </View>

          {visible.length === 0 ? (
            <View style={styles.block}>
              <Text variant="body">None of your saved spots are this kind yet.</Text>
            </View>
          ) : null}
          {showHome && where.at ? (
            <HomeScope
              spots={homeSpots.filter((p) => matchesKind(p, kind))}
              where={where.at}
              statusOf={statusOf}
              width={W}
              open={isOpen('home', !focus)}
              onToggle={() => toggle('home', !focus)}
            />
          ) : null}
          {awayGroups.length > 0 ? (
            <AwayScope
              groups={awayGroups}
              kind={kind}
              from={where.at}
              statusOf={statusOf}
              focus={focus}
              labelled={showHome}
              isOpen={(name, first) => isOpen(name, awayDefault(name, first))}
              onToggle={(name, first) => toggle(name, awayDefault(name, first))}
            />
          ) : null}
        </ScrollView>
      </DeepPanel>
      </Animated.View>
    </SkyScreen>
  );
}

/**
 * A heading that folds what's under it away: a city's places, or the ones near home. Folded, a long
 * list is a short list of headings, and one tap opens the one you came for.
 */
function Fold({
  title,
  detail,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  detail: string;
  open: boolean;
  onToggle: () => void;
  /** Something beside the heading that isn't part of it, such as the city's map button. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.districtHead}>
        <PressableScale
          onPress={() => {
            haptic.selection();
            onToggle();
          }}
          pressedScale={0.99}
          hitSlop={0}
          containerStyle={styles.foldTap}
          style={styles.foldHead}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          accessibilityLabel={`${title}, ${detail}`}
        >
          <View style={{ flex: 1 }}>
            <Text variant="headline">{title}</Text>
            <Text variant="data">{detail}</Text>
          </View>
          <Animated.View style={[fold.chevron, open && fold.chevronOpen]}>
            <Feather name="chevron-down" size={18} color={skyInk.soft} />
          </Animated.View>
        </PressableScale>
        {action}
      </View>
      {open ? <Animated.View entering={FADE_IN}>{children}</Animated.View> : null}
    </View>
  );
}

const fold = css.create({
  chevron: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '0deg' }],
    transitionProperty: 'transform',
    transitionDuration: `${DURATION.small}ms`,
  },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
});

function DeepPanel({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  const look = useScreenSky();
  return (
    <Glass blur tint={deepGlass(look)} radius={radii.sheet} style={style}>
      {children}
    </Glass>
  );
}

/** Near home: the weekend question comes first, the full list second. */
function HomeScope({
  spots,
  where,
  statusOf,
  width,
  open,
  onToggle,
}: {
  spots: Place[];
  where: { lat: number; lng: number };
  statusOf: (id: string) => 'want' | 'been';
  width: number;
  open: boolean;
  onToggle: () => void;
}) {
  // Somewhere you've already been is not a weekend suggestion.
  const unvisited = spots.filter((s) => statusOf(s.id) === 'want');
  const routes = useMemo(() => weekendRoutes(where, unvisited, DAY_BUDGET), [where, unvisited]);
  const clusters = useMemo(() => clusterSpots(spots), [spots]);
  const cardW = Math.min(268, width - GUTTER * 2 - 40);

  if (spots.length === 0) return null;

  return (
    <>
      {routes.length > 0 ? (
        <Animated.View entering={fadeUp(60)}>
          <View style={styles.sectionHead}>
            <Text variant="micro">This weekend</Text>
            <Text variant="headline" accessibilityRole="header">Ready-made outings</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.routeRow}
            snapToInterval={cardW + 12}
            decelerationRate="fast"
          >
            {routes.map((r) => (
              <WeekendRouteCard
                key={r.id}
                route={r}
                width={cardW}
                onPress={() => router.push({ pathname: '/place/[id]', params: { id: r.spots[0].id } })}
              />
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      <Fold title="Near home" detail={`${spots.length} ${spots.length === 1 ? 'spot' : 'spots'}`} open={open} onToggle={onToggle}>
        {clusters.map((c) => (
          <View key={c.id} style={styles.cluster}>
            <ClusterHead label={c.label} count={c.spots.length} alone={clusters.length === 1} />
            {c.spots.map((s) => (
              <SpotRow
                key={s.id}
                spot={s}
                minutes={driveMinutes(where, s)}
                status={statusOf(s.id)}
                onPress={() => router.push({ pathname: '/place/[id]', params: { id: s.id } })}
              />
            ))}
          </View>
        ))}
      </Fold>
    </>
  );
}

/**
 * A group's heading inside a city: its neighbourhood and how many spots. Left out when it would say
 * nothing: the only group (the city heading covers it), no neighbourhood name, or the city's own name.
 */
function ClusterHead({ label, count, alone, same }: { label: string; count: number; alone: boolean; same?: boolean }) {
  if (!label || alone || same) return null;
  return (
    <Text variant="label" color={skyInk.soft}>
      {label} · {count}
    </Text>
  );
}

/** Away: grouped by district, because that is the unit an arrival notification speaks in. */
function AwayScope({
  groups,
  kind,
  from,
  statusOf,
  focus,
  labelled,
  isOpen,
  onToggle,
}: {
  groups: { districtId: string | null; name: string; state: string; spots: Place[] }[];
  kind: SpotKind;
  /** Null with no home and no position: then no times or distances are shown. */
  from: { lat: number; lng: number } | null;
  statusOf: (id: string) => 'want' | 'been';
  focus: string | null;
  /** With spots near home above, a heading says where "away" starts. */
  labelled: boolean;
  /** Whether a city's heading is open, and the tap that changes it; `first` is the top one in the list. */
  isOpen: (name: string, first: boolean) => boolean;
  onToggle: (name: string, first: boolean) => void;
}) {
  const shown = groups
    .map((g) => ({ ...g, spots: g.spots.filter((p) => matchesKind(p, kind)) }))
    .filter((g) => g.spots.length > 0)
    .sort((a, b) => Number(b.districtId === focus) - Number(a.districtId === focus));

  if (shown.length === 0) return null;

  return (
    <>
      {labelled ? (
        <View style={styles.sectionHead}>
          <Text variant="micro">Away from home</Text>
        </View>
      ) : null}
      {shown.map((g, i) => {
        const cityId = g.spots[0].cityId;
        const watched = !!getDistrict(g.districtId ?? undefined);
        const far = !from || Math.min(...g.spots.map((s) => driveMinutes(from, s))) > DAY_TRIP_MINUTES;
        const clusters = clusterSpots(g.spots);
        const creators = new Set(g.spots.map((s) => (s.source.kind === 'reel' ? getReel(s.source.reelId)?.creator : null)));
        return (
          <Fold
            key={g.name}
            title={g.name}
            detail={
              `${g.spots.length} ${g.spots.length === 1 ? 'spot' : 'spots'}` +
              (g.state && g.state !== g.name ? ` · ${g.state}` : '') +
              (far && from ? ` · ${kmAway(from, g.spots)} away` : '') +
              (watched ? ' · we’ll tell you when you arrive' : '')
            }
            open={isOpen(g.name, i === 0)}
            onToggle={() => onToggle(g.name, i === 0)}
            action={
              <PressableScale
                onPress={() => router.push({ pathname: '/citymap/[id]', params: { id: cityId } })}
                style={styles.mapLink}
                accessibilityRole="button"
                accessibilityLabel={`Open the ${getCity(cityId)?.name ?? g.name} map`}
              >
                <Feather name="map" size={15} color={skyInk.strong} />
              </PressableScale>
            }
          >
            {clusters.map((c) => (
              <View key={c.id} style={styles.cluster}>
                <ClusterHead label={c.label} count={c.spots.length} alone={clusters.length === 1} same={c.label === g.name} />
                {c.spots.map((s) => (
                  <SpotRow
                    key={s.id}
                    spot={s}
                    minutes={far || !from ? null : driveMinutes(from, s)}
                    showCreator={creators.size > 1}
                    status={statusOf(s.id)}
                    onPress={() => router.push({ pathname: '/place/[id]', params: { id: s.id } })}
                  />
                ))}
              </View>
            ))}
          </Fold>
        );
      })}
    </>
  );
}

function EmptySpots() {
  const insets = useSafeAreaInsets();
  return (
    <SkyScreen style={[styles.empty, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 100 }]}>
      <Text variant="display" accessibilityRole="header" style={{ textAlign: 'center' }}>
        Nothing saved yet.
      </Text>
      <Text variant="body" style={{ textAlign: 'center' }}>
        Paste a video on Home: a café, a beach, a hidden spot. Every place in it lands here, sorted by how far it is from you.
      </Text>
      <Button trailingArrow label="Go to Home" onPress={() => router.replace('/')} style={{ marginTop: 8, alignSelf: 'stretch' }} />
    </SkyScreen>
  );
}

const styles = StyleSheet.create({
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  topBar: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  // A 44pt tap round a chip-sized circle, so it lines up with the filters beside it.
  searchHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginHorizontal: -5 },
  searchChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skyFill.raised,
    borderWidth: 1,
    borderColor: skyInk.rim,
  },
  // A 44pt tap around the 32pt pill.
  setHome: { minHeight: 44, justifyContent: 'center', maxWidth: '55%' },
  wherePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '55%',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    backgroundColor: skyVeil(0.4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  panelGlass: {
    flex: 1,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    boxShadow: '0 -10px 30px rgba(4,10,30,0.18)',
  },
  // The whole strip takes the pull and the tap, not the 4pt bar drawn in it.
  handle: { height: 28, alignItems: 'center', justifyContent: 'center' },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: skyInk.outline,
  },
  block: { paddingHorizontal: GUTTER, paddingTop: 14, gap: 4 },
  chips: { paddingLeft: GUTTER, paddingTop: 2 },
  sectionHead: { paddingHorizontal: GUTTER, paddingTop: 22, gap: 4 },
  routeRow: { gap: 12, paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 4 },
  districtHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foldTap: { flex: 1 },
  foldHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  cluster: { paddingTop: 10, gap: 2 },
  mapLink: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skyFill.pane,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  empty: { flex: 1, paddingHorizontal: GUTTER, gap: 12, alignItems: 'center', justifyContent: 'center' },
});
