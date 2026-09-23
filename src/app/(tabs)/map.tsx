import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CityMap, fitCameraToRect, flyTo, useCamera, type MapPin } from '@/components/CityMap';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { ArrivalBanner } from '@/components/spots/ArrivalBanner';
import { Chips, ScopeToggle } from '@/components/spots/Chips';
import { SpotRow } from '@/components/spots/SpotRow';
import { WeekendRouteCard } from '@/components/spots/WeekendRouteCard';
import { getCity } from '@/data/api';
import { KERALA, getDistrict } from '@/data/regions';
import type { Place } from '@/data/types';
import type { Point } from '@/lib/geo';
import { fadeUp } from '@/lib/motion';
import {
  KIND_LABEL,
  REACH_LABEL,
  clusterSpots,
  driveMinutes,
  matchesKind,
  weekendRoutes,
  withinReach,
  type ReachMinutes,
  type SpotKind,
} from '@/lib/spots';
import { useArrivalTargets, useSpotStatus, useSpotsByDistrict, useTrips } from '@/state/trips';
import { useWhereIAm } from '@/state/where';
import { fonts, light, shadows } from '@/theme/tokens';

const KINDS: SpotKind[] = ['all', 'food', 'sight', 'experience'];
const REACHES: ReachMinutes[] = [null, 45, 90, 180];
const GUTTER = 16;
const PANEL_RATIO = 0.56;
/** A full day out, door to door. The reach chips do the real narrowing. */
const DAY_BUDGET = 600;

type Scope = 'home' | 'away';

export default function SpotsMap() {
  const { district: districtParam } = useLocalSearchParams<{ district?: string }>();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const groups = useSpotsByDistrict();
  const targets = useArrivalTargets();
  const { statusOf, toggle } = useSpotStatus();
  const where = useWhereIAm();

  const [scope, setScope] = useState<Scope>('home');
  const [kind, setKind] = useState<SpotKind>('all');
  const [reach, setReach] = useState<ReachMinutes>(null);

  const homeGroups = groups.filter((g) => g.isHome);
  const awayGroups = groups.filter((g) => !g.isHome);
  const scoped = scope === 'home' ? homeGroups : awayGroups;

  // A tapped arrival notification lands here, on that district.
  const jumped = useRef<string | null>(null);
  useEffect(() => {
    if (!districtParam || jumped.current === districtParam) return;
    jumped.current = districtParam;
    const isHome = state.homeDistrictId === districtParam;
    setScope(isHome ? 'home' : 'away');
    setKind('all');
    setReach(null);
  }, [districtParam, state.homeDistrictId]);

  const visible = useMemo(
    () =>
      scoped
        .flatMap((g) => g.spots)
        .filter((p) => matchesKind(p, kind) && withinReach(where.at, p, reach)),
    [scoped, kind, reach, where.at],
  );

  // Only Kerala spots carry a position on the region map; the rest are listed, not plotted.
  const pins: MapPin[] = useMemo(
    () =>
      visible
        .filter((p) => p.regionPoint)
        .map((p) => ({ id: p.id, place: p, point: p.regionPoint as Point })),
    [visible],
  );

  const panelH = Math.round(H * PANEL_RATIO);
  const fit = useMemo(() => {
    const points = pins.length > 0 ? pins.map((p) => p.point as Point) : regionCorners();
    // Generous padding on purpose: a tight cluster like Fort Kochi would otherwise fill the
    // screen with blank paper. Keeping the district labels in frame is what makes it a map.
    return fitCameraToRect(points, { w: W, h: H }, { top: insets.top + 56, bottom: panelH }, 300);
  }, [pins, W, H, insets.top, panelH]);

  const camera = useCamera(fit);
  // Re-fit when the filters change what's on the map, but never fight a pan in progress.
  const fitKey = `${fit.x.toFixed(0)}:${fit.y.toFixed(0)}:${fit.s.toFixed(3)}`;
  useEffect(() => {
    flyTo(camera, fit);
    // Keyed on the fit itself: a new frame means new content, not a user gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const arrived = state.arrivedDistrictId;
  const arrivedTarget = targets.find((t) => t.districtId === arrived);
  const totalSaved = groups.reduce((n, g) => n + g.spots.length, 0);

  if (totalSaved === 0) return <EmptySpots />;

  return (
    <View style={styles.fill}>
      <CityMap
        city={{ map: KERALA.map }}
        world={KERALA.world}
        pins={pins}
        width={W}
        height={H}
        camera={camera}
        maxScale={Math.max(fit.s * 1.6, 0.8)}
        pinSize={40}
        onPinPress={(id) => router.push({ pathname: '/place/[id]', params: { id } })}
      />

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(245,244,241,0.9)', 'rgba(245,244,241,0)']}
        style={[styles.topFade, { height: insets.top + 80 }]}
      />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.wordmark}>Your map</Text>
        <View style={styles.wherePill}>
          <Feather
            name={where.source === 'device' ? 'navigation' : 'home'}
            size={12}
            color={light.inkSoft}
          />
          <Text variant="data" numberOfLines={1}>
            {where.label}
          </Text>
        </View>
      </View>

      <View style={[styles.panel, { height: panelH }]}>
        <View style={styles.grabber} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 92, paddingTop: 4 }}
        >
          {arrived && arrivedTarget ? (
            <View style={styles.block}>
              <ArrivalBanner
                district={arrivedTarget.name}
                spots={arrivedTarget.spots}
                topArea={arrivedTarget.topArea}
                onSee={() => {
                  setScope(state.homeDistrictId === arrived ? 'home' : 'away');
                  setKind('all');
                  setReach(null);
                  dispatch({ type: 'clearArrival' });
                }}
                onDismiss={() => dispatch({ type: 'clearArrival' })}
              />
            </View>
          ) : null}

          <View style={styles.block}>
            <ScopeToggle<Scope>
              value={scope}
              onChange={setScope}
              options={[
                { key: 'home', label: 'Near home', count: homeGroups.reduce((n, g) => n + g.spots.length, 0) },
                { key: 'away', label: 'Away', count: awayGroups.reduce((n, g) => n + g.spots.length, 0) },
              ]}
            />
          </View>

          <View style={styles.chips}>
            <Chips
              value={kind}
              onChange={setKind}
              options={KINDS.map((k) => ({ key: k, label: KIND_LABEL[k] }))}
            />
          </View>
          <View style={styles.chips}>
            <Chips
              value={reach}
              onChange={setReach}
              options={REACHES.map((r) => ({ key: r, label: REACH_LABEL[String(r)] }))}
            />
          </View>

          {scope === 'home' ? (
            <HomeScope spots={visible} where={where.at} statusOf={statusOf} toggle={toggle} width={W} />
          ) : (
            <AwayScope
              groups={awayGroups}
              kind={kind}
              reach={reach}
              from={where.at}
              statusOf={statusOf}
              toggle={toggle}
              focus={arrived ?? districtParam ?? null}
            />
          )}
        </ScrollView>
      </View>
    </View>
  );
}

/** Near home: the weekend question comes first, the full list second. */
function HomeScope({
  spots,
  where,
  statusOf,
  toggle,
  width,
}: {
  spots: Place[];
  where: { lat: number; lng: number };
  statusOf: (id: string) => 'want' | 'been';
  toggle: (id: string) => void;
  width: number;
}) {
  // Somewhere you've already been is not a weekend suggestion.
  const unvisited = spots.filter((s) => statusOf(s.id) === 'want');
  const routes = useMemo(() => weekendRoutes(where, unvisited, DAY_BUDGET), [where, unvisited]);
  const clusters = useMemo(() => clusterSpots(spots), [spots]);
  const cardW = Math.min(268, width - GUTTER * 2 - 40);

  if (spots.length === 0) {
    return (
      <View style={styles.block}>
        <Text variant="body">Nothing near home matches that. Try widening the distance.</Text>
      </View>
    );
  }

  return (
    <>
      {routes.length > 0 ? (
        <Animated.View entering={fadeUp(60)}>
          <View style={styles.sectionHead}>
            <Text variant="micro">This weekend</Text>
            <Text variant="headline">Ready-made outings</Text>
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

      <View style={styles.sectionHead}>
        <Text variant="micro">All {spots.length} near home</Text>
      </View>
      {clusters.map((c) => (
        <View key={c.id} style={styles.block}>
          <Text variant="label" color={light.inkSoft}>
            {c.label} · {c.spots.length}
          </Text>
          {c.spots.map((s) => (
            <SpotRow
              key={s.id}
              spot={s}
              minutes={driveMinutes(where, s)}
              status={statusOf(s.id)}
              onToggleStatus={() => toggle(s.id)}
              onPress={() => router.push({ pathname: '/place/[id]', params: { id: s.id } })}
            />
          ))}
        </View>
      ))}
    </>
  );
}

/** Away: grouped by district, because that is the unit an arrival notification speaks in. */
function AwayScope({
  groups,
  kind,
  reach,
  from,
  statusOf,
  toggle,
  focus,
}: {
  groups: { districtId: string | null; name: string; state: string; spots: Place[] }[];
  kind: SpotKind;
  reach: ReachMinutes;
  from: { lat: number; lng: number };
  statusOf: (id: string) => 'want' | 'been';
  toggle: (id: string) => void;
  focus: string | null;
}) {
  const shown = groups
    .map((g) => ({
      ...g,
      spots: g.spots.filter((p) => matchesKind(p, kind) && withinReach(from, p, reach)),
    }))
    .filter((g) => g.spots.length > 0)
    .sort((a, b) => Number(b.districtId === focus) - Number(a.districtId === focus));

  if (shown.length === 0) {
    return (
      <View style={styles.block}>
        <Text variant="body">No saved spots away from home match that yet.</Text>
      </View>
    );
  }

  return (
    <>
      {shown.map((g) => {
        const cityId = g.spots[0].cityId;
        const watched = !!getDistrict(g.districtId ?? undefined);
        return (
          <View key={g.name} style={styles.block}>
            <View style={styles.districtHead}>
              <View style={{ flex: 1 }}>
                <Text variant="headline">{g.name}</Text>
                <Text variant="data">
                  {g.spots.length} {g.spots.length === 1 ? 'spot' : 'spots'} · {g.state}
                  {watched ? ' · we’ll tell you when you arrive' : ''}
                </Text>
              </View>
              <PressableScale
                onPress={() => router.push({ pathname: '/citymap/[id]', params: { id: cityId } })}
                style={styles.mapLink}
                accessibilityRole="button"
                accessibilityLabel={`Open the ${getCity(cityId)?.name ?? g.name} map`}
              >
                <Feather name="map" size={15} color={light.ink} />
              </PressableScale>
            </View>
            {clusterSpots(g.spots).map((c) => (
              <View key={c.id} style={styles.cluster}>
                <Text variant="label" color={light.inkSoft}>
                  {c.label} · {c.spots.length}
                </Text>
                {c.spots.map((s) => (
                  <SpotRow
                    key={s.id}
                    spot={s}
                    minutes={driveMinutes(from, s)}
                    status={statusOf(s.id)}
                    onToggleStatus={() => toggle(s.id)}
                    onPress={() => router.push({ pathname: '/place/[id]', params: { id: s.id } })}
                  />
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </>
  );
}

function EmptySpots() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.empty, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 100 }]}>
      <Text style={styles.wordmark}>Your map</Text>
      <Text variant="display" style={{ textAlign: 'center' }}>
        Nothing saved yet.
      </Text>
      <Text variant="body" style={{ textAlign: 'center' }}>
        Paste a reel on Home. Every spot in it lands here, sorted by how far it is from you.
      </Text>
      <Button label="Go to Home" onPress={() => router.replace('/')} style={{ marginTop: 8 }} />
    </View>
  );
}

const regionCorners = (): Point[] => {
  const { x0, y0, w, h } = KERALA.world;
  return [
    [x0 + w * 0.18, y0 + h * 0.22],
    [x0 + w * 0.82, y0 + h * 0.78],
  ];
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.mapLand },
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
  wordmark: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.8, color: light.ink },
  wherePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '55%',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.button,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: light.panel,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    boxShadow: shadows.panel,
  },
  grabber: {
    alignSelf: 'center',
    marginTop: 10,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: light.lineStrong,
  },
  block: { paddingHorizontal: GUTTER, paddingTop: 14, gap: 4 },
  chips: { paddingLeft: GUTTER, paddingTop: 10 },
  sectionHead: { paddingHorizontal: GUTTER, paddingTop: 22, gap: 4 },
  routeRow: { gap: 12, paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 4 },
  districtHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: 4 },
  cluster: { paddingTop: 10, gap: 2 },
  mapLink: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.canvas,
    borderWidth: 1,
    borderColor: light.line,
  },
  empty: { flex: 1, paddingHorizontal: 32, gap: 12, alignItems: 'center', justifyContent: 'center' },
});
