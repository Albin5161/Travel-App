import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { Chips } from '@/components/spots/Chips';
import { places } from '@/data/catalog';
import { allDistricts } from '@/data/regions';
import { haptic } from '@/lib/haptics';
import { project, SPRING_DRAG } from '@/lib/motion';
import { useTrips } from '@/state/trips';
import { fonts, light, shadows } from '@/theme/tokens';

const PAGES = 3;
const GUTTER = 28;

/**
 * Three screens, then out. Two of them explain the halves of the app — the trip you plan and the
 * weekend you don't — and the third asks the one thing the app genuinely can't work without.
 * Permissions are not asked here: they come later, in context, where the reason can be stated.
 */
export default function Onboarding() {
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const [page, setPage] = useState(0);
  // Position in pages, continuous. The finger writes it directly, so the pages track the drag
  // rather than snapping between states, and every derived animation reads this one value.
  const p = useSharedValue(0);
  const start = useSharedValue(0);

  const go = (next: number) => {
    setPage(next);
    p.set(withSpring(next, SPRING_DRAG));
  };

  const swipe = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onStart(() => {
      start.set(p.get());
    })
    .onUpdate((e) => {
      const raw = start.get() - e.translationX / W;
      // Rubber-band past the ends instead of stopping dead.
      p.set(raw < 0 ? raw * 0.35 : raw > PAGES - 1 ? PAGES - 1 + (raw - (PAGES - 1)) * 0.35 : raw);
    })
    .onEnd((e) => {
      const projected = p.get() - project(e.velocityX) / W;
      const next = Math.max(0, Math.min(PAGES - 1, Math.round(projected)));
      p.set(withSpring(next, { ...SPRING_DRAG, velocity: -e.velocityX / W }));
      scheduleOnRN(setPage, next);
    });

  const finish = () => {
    haptic.success();
    dispatch({ type: 'finishOnboarding' });
    router.replace('/');
  };

  const last = page === PAGES - 1;

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[light.canvasTop, light.canvas]} style={styles.wash} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.wordmark}>Raahi</Text>
        {last ? null : (
          <PressableScale onPress={finish} accessibilityRole="button" accessibilityLabel="Skip setup">
            <Text variant="label" color={light.inkFaint}>
              Skip
            </Text>
          </PressableScale>
        )}
      </View>

      {/* Clipped: the row is three screens wide, and without this it stretches the whole layout
          to 3x the viewport — which silently moves every other control off the screen. */}
      <View style={styles.viewport}>
        <GestureDetector gesture={swipe}>
          <Row p={p} width={W}>
        <Page index={0} p={p}>
          <ReelFan />
          <Copy
            lead={'Your next trip is\nhiding in your\n'}
            title="saved videos."
            body="Paste an Instagram or YouTube link. Every place in it is pulled out, named, and put on your map."
          />
        </Page>

        <Page index={1} p={p}>
          <WeekendPreview />
          <Copy
            lead={'The ones near\nhome become\n'}
            title="your weekends."
            body="Spots you save close by get grouped into outings you can actually do on a Saturday — with the drive time worked out."
          />
        </Page>

        <Page index={2} p={p}>
          <HomeRings />
          <Copy
            title={'Where do\nyou live?'}
            body="So we know which spots are a weekend away — and which ones to mention when you're somewhere else."
          />
          <View style={styles.districtPicker}>
            <Chips
              value={state.homeDistrictId}
              onChange={(id) => id && dispatch({ type: 'setHomeDistrict', districtId: id })}
              options={allDistricts.map((d) => ({ key: d.id as string | null, label: d.name }))}
            />
          </View>
        </Page>
          </Row>
        </GestureDetector>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Dots p={p} />
        <Button label={last ? 'Start collecting' : 'Next'} onPress={() => (last ? finish() : go(page + 1))} />
      </View>
    </View>
  );
}

/** The three pages side by side, slid by the shared page position. */
function Row({ p, width, children }: { p: SharedValue<number>; width: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -p.get() * width }] }));
  return (
    <Animated.View style={[styles.row, { width: width * PAGES }, style]}>{children}</Animated.View>
  );
}

/** Each page's contents drift and fade against the swipe, so the pages feel stacked in depth. */
function Page({ index, p, children }: { index: number; p: SharedValue<number>; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const d = p.get() - index;
    return {
      opacity: interpolate(Math.abs(d), [0, 0.9], [1, 0], Extrapolation.CLAMP),
      // Contents move with the page but slower, so the pages read as stacked in depth.
      transform: reduced ? [] : [{ translateX: d * 46 }, { scale: 1 - Math.min(Math.abs(d), 1) * 0.06 }],
    };
  });
  return (
    <View style={styles.pageSlot}>
      <Animated.View style={[styles.page, style]}>{children}</Animated.View>
    </View>
  );
}

/** A lead-in in Medium, the payoff in ExtraBold: the same two-weight headline as home. */
function Copy({ lead, title, body }: { lead?: string; title: string; body: string }) {
  return (
    <View style={styles.copy}>
      <Text style={[styles.title, lead ? styles.titleLead : null]}>
        {lead}
        {lead ? <Text style={styles.title}>{title}</Text> : title}
      </Text>
      <Text variant="body" style={styles.body}>
        {body}
      </Text>
    </View>
  );
}

/** Home, drawn as the rings a location ping leaves: your district at the centre, weekends around it. */
function HomeRings() {
  return (
    <View style={styles.art}>
      <Svg width={190} height={190} viewBox="0 0 190 190">
        <Circle cx={95} cy={95} r={92} fill="none" stroke={light.line} strokeWidth={1.5} />
        <Circle cx={95} cy={95} r={62} fill="none" stroke={light.lineStrong} strokeWidth={1.5} />
        <Circle cx={95} cy={95} r={32} fill={light.panel} stroke={light.lineStrong} strokeWidth={1.5} />
        <Circle cx={95} cy={95} r={9} fill={light.accent} stroke={light.panel} strokeWidth={3} />
      </Svg>
    </View>
  );
}

/** Three saved reels, fanned like cards still waiting to be dealt. */
function ReelFan() {
  const shots = [places['ktm-kumarakom'], places['kochi-mural'], places['ktm-illickal']];
  return (
    <View style={styles.art}>
      {shots.map((p, i) => (
        <View
          key={p.id}
          style={[
            styles.fanCard,
            {
              transform: [
                { translateX: (i - 1) * 62 },
                { rotate: `${(i - 1) * 11}deg` },
                { translateY: Math.abs(i - 1) * 16 },
              ],
              zIndex: i === 1 ? 3 : 1,
            },
          ]}
        >
          <Image source={p.photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
          {i === 1 ? <View style={styles.fanPin} /> : null}
        </View>
      ))}
    </View>
  );
}

/** A weekend outing, exactly as it appears on the map tab. */
function WeekendPreview() {
  const shots = [places['ktm-illickal'], places['ktm-marmala']];
  return (
    <View style={styles.art}>
      <View style={styles.routeCard}>
        <View style={styles.routePhotos}>
          {shots.map((p, i) => (
            <Image
              key={p.id}
              source={p.photo}
              style={[styles.routePhoto, i > 0 && styles.routePhotoStacked]}
              contentFit="cover"
              transition={0}
            />
          ))}
        </View>
        <Text variant="micro">2 stops</Text>
        <Text variant="headline">Teekoy</Text>
        <Text variant="data">7 hrs out and back · about ₹250</Text>
      </View>
    </View>
  );
}

function Dots({ p }: { p: SharedValue<number> }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: PAGES }, (_, i) => (
        <Dot key={i} index={i} p={p} />
      ))}
    </View>
  );
}

function Dot({ index, p }: { index: number; p: SharedValue<number> }) {
  // The active dot stretches into a bar. It is absolutely positioned and childless, so animating
  // width costs no layout pass on anything else.
  const style = useAnimatedStyle(() => {
    const d = Math.abs(p.get() - index);
    return {
      width: interpolate(d, [0, 1], [20, 6], Extrapolation.CLAMP),
      opacity: interpolate(d, [0, 1], [1, 0.28], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingBottom: 8,
  },
  wordmark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.9, color: light.ink },
  viewport: { flex: 1, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
  pageSlot: { flex: 1 },
  page: { flex: 1, paddingHorizontal: GUTTER, justifyContent: 'center', gap: 34 },
  art: { height: 230, alignItems: 'center', justifyContent: 'center' },
  fanCard: {
    position: 'absolute',
    width: 124,
    height: 184,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: light.canvasTop,
    borderWidth: 3,
    borderColor: light.panel,
    boxShadow: shadows.card,
  },
  fanPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -9,
    marginTop: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: light.panel,
    backgroundColor: light.accent,
  },
  routeCard: {
    width: 250,
    padding: 18,
    borderRadius: 24,
    gap: 3,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.card,
  },
  routePhotos: { flexDirection: 'row', marginBottom: 12 },
  routePhoto: { width: 76, height: 84, borderRadius: 14, backgroundColor: light.canvasTop },
  routePhotoStacked: { marginLeft: -22, borderWidth: 2, borderColor: light.panel },
  districtPicker: { marginTop: -12, marginHorizontal: -GUTTER, paddingLeft: GUTTER },
  copy: { gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 35, color: light.ink, letterSpacing: -1 },
  titleLead: { fontFamily: fonts.displayMedium, color: light.inkSoft, letterSpacing: -0.5 },
  body: { paddingRight: 8 },
  bottom: { paddingHorizontal: GUTTER, gap: 22 },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: 6, height: 6, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3, backgroundColor: light.ink },
});
