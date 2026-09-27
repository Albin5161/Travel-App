import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CityMap, fitCameraToRect, flyTo, useCamera, type MapPin } from '@/components/CityMap';
import { GoogleMap } from '@/components/GoogleMap';
import { PressableScale } from '@/components/PressableScale';
import { Glass } from '@/components/sky/Glass';
import { SkyScreen, useScreenSky } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { ArrivalBanner } from '@/components/spots/ArrivalBanner';
import { Chips } from '@/components/spots/Chips';
import { SpotRow } from '@/components/spots/SpotRow';
import { WeekendRouteCard } from '@/components/spots/WeekendRouteCard';
import { getCity, getReel } from '@/data/api';
import { KERALA, getDistrict } from '@/data/regions';
import type { Place } from '@/data/types';
import type { Point } from '@/lib/geo';
import { fadeUp } from '@/lib/motion';
import { KIND_LABEL, clusterSpots, DAY_TRIP_MINUTES, driveMinutes, kmAway, matchesKind, weekendRoutes, type SpotKind } from '@/lib/spots';
import { useArrivalTargets, useSpotStatus, useSpotsByDistrict, useTrips } from '@/state/trips';
import { useWhereIAm } from '@/state/where';
import { deepGlass, skyFill, skyInk } from '@/theme/sky';
import { Tone } from '@/theme/tone';
import { radii, space } from '@/theme/tokens';

const KINDS: SpotKind[] = ['all', 'food', 'sight', 'experience'];
const GUTTER = space.screen;
// The map gets the top half: enough to see where everything is, the list takes the rest.
const PANEL_RATIO = 0.5;
/** A full day out, door to door. The reach chips do the real narrowing. */
const DAY_BUDGET = 600;

export default function SpotsMap() {
  const { district: districtParam } = useLocalSearchParams<{ district?: string }>();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const groups = useSpotsByDistrict();
  const targets = useArrivalTargets();
  const { statusOf, toggle } = useSpotStatus();
  const where = useWhereIAm();

  // One filter, what kind of place. Near home and away are both listed, near home first, and every
  // row says how far it is: no separate switches for scope or distance.
  const [kind, setKind] = useState<SpotKind>('all');

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

  // The phone app draws the painted Kerala map, where only Kerala spots have a place; the web uses
  // Google's map, where every spot does.
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
    <SkyScreen>
      {/* The map is paper: its labels keep the paper palette. */}
      <Tone value="light">
      {Platform.OS === 'web' ? (
        <GoogleMap
          pins={visible.map((p) => ({ id: p.id, name: p.name, coords: p.coords, photo: p.photo }))}
          width={W}
          height={H}
          padding={{ top: insets.top + 80, bottom: panelH + 24, left: 40, right: 40 }}
          focusId={null}
          onPinPress={(id) => router.push({ pathname: '/place/[id]', params: { id } })}
        />
      ) : (
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
      )}
      </Tone>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(4,10,30,0.55)', 'rgba(4,10,30,0)']}
        style={[styles.topFade, { height: insets.top + 80 }]}
      />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text variant="display" accessibilityRole="header">
          Your map
        </Text>
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
      </View>

      {/* The paper map is light, so the panel over it is deep glass: white type stays readable. */}
      <DeepPanel style={[styles.panel, { height: panelH }]}>
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
            />
          </View>

          {visible.length === 0 ? (
            <View style={styles.block}>
              <Text variant="body">None of your saved spots are this kind yet.</Text>
            </View>
          ) : null}
          {homeSpots.length > 0 ? (
            <HomeScope
              spots={homeSpots.filter((p) => matchesKind(p, kind))}
              where={where.at}
              statusOf={statusOf}
              toggle={toggle}
              width={W}
            />
          ) : null}
          {awayGroups.length > 0 ? (
            <AwayScope
              groups={awayGroups}
              kind={kind}
              from={where.at}
              statusOf={statusOf}
              toggle={toggle}
              focus={arrived ?? districtParam ?? null}
              labelled={homeSpots.length > 0}
            />
          ) : null}
        </ScrollView>
      </DeepPanel>
    </SkyScreen>
  );
}

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

      <View style={styles.sectionHead}>
        <Text variant="micro">Near home · {spots.length}</Text>
      </View>
      {clusters.map((c) => (
        <View key={c.id} style={styles.block}>
          <ClusterHead label={c.label} count={c.spots.length} alone={clusters.length === 1} />
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
  toggle,
  focus,
  labelled,
}: {
  groups: { districtId: string | null; name: string; state: string; spots: Place[] }[];
  kind: SpotKind;
  from: { lat: number; lng: number };
  statusOf: (id: string) => 'want' | 'been';
  toggle: (id: string) => void;
  focus: string | null;
  /** With spots near home above, a heading says where "away" starts. */
  labelled: boolean;
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
      {shown.map((g) => {
        const cityId = g.spots[0].cityId;
        const watched = !!getDistrict(g.districtId ?? undefined);
        const far = Math.min(...g.spots.map((s) => driveMinutes(from, s))) > DAY_TRIP_MINUTES;
        const clusters = clusterSpots(g.spots);
        const creators = new Set(g.spots.map((s) => (s.source.kind === 'reel' ? getReel(s.source.reelId)?.creator : null)));
        return (
          <View key={g.name} style={styles.block}>
            <View style={styles.districtHead}>
              <View style={{ flex: 1 }}>
                <Text variant="headline" accessibilityRole="header">{g.name}</Text>
                <Text variant="data">
                  {g.spots.length} {g.spots.length === 1 ? 'spot' : 'spots'}
                  {g.state && g.state !== g.name ? ` · ${g.state}` : ''}
                  {far ? ` · ${kmAway(from, g.spots)} away` : ''}
                  {watched ? ' · we’ll tell you when you arrive' : ''}
                </Text>
              </View>
              <PressableScale
                onPress={() => router.push({ pathname: '/citymap/[id]', params: { id: cityId } })}
                style={styles.mapLink}
                accessibilityRole="button"
                accessibilityLabel={`Open the ${getCity(cityId)?.name ?? g.name} map`}
              >
                <Feather name="map" size={15} color={skyInk.strong} />
              </PressableScale>
            </View>
            {clusters.map((c) => (
              <View key={c.id} style={styles.cluster}>
                <ClusterHead label={c.label} count={c.spots.length} alone={clusters.length === 1} same={c.label === g.name} />
                {c.spots.map((s) => (
                  <SpotRow
                    key={s.id}
                    spot={s}
                    minutes={far ? null : driveMinutes(from, s)}
                    showCreator={creators.size > 1}
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

const regionCorners = (): Point[] => {
  const { x0, y0, w, h } = KERALA.world;
  return [
    [x0 + w * 0.18, y0 + h * 0.22],
    [x0 + w * 0.82, y0 + h * 0.78],
  ];
};

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
  wherePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '55%',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(4,10,30,0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    boxShadow: '0 -10px 30px rgba(4,10,30,0.18)',
  },
  grabber: {
    alignSelf: 'center',
    marginTop: 10,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: skyInk.outline,
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
    backgroundColor: skyFill.pane,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  empty: { flex: 1, paddingHorizontal: GUTTER, gap: 12, alignItems: 'center', justifyContent: 'center' },
});
