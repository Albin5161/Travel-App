import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/Button';
import { CityHeroContent, HeroScrim } from '@/components/CityHero';
import { IconButton } from '@/components/IconButton';
import { PANEL_HEADER_H, PanelTabs, restPeek } from '@/components/plan/PanelTabs';
import { GoodToKnowSection, OverviewSection, PlacesSection, PlanSection } from '@/components/plan/PlanSections';
import { Text } from '@/components/Text';
import { getCity } from '@/data/api';
import { formatRupees, getCityInfo } from '@/data/cityInfo';
import { buildPlan } from '@/data/plan';
import { haptic } from '@/lib/haptics';
import { useCityPlaces, useTrips } from '@/state/trips';
import { light, shadows } from '@/theme/tokens';

// Top strip of photo that stays visible when the panel is fully up (holds the back button).
const TOP_STRIP = 56;

/**
 * The city page, Plan mode. A full-bleed photo with the city's title; the Plan panel rests at the
 * bottom and slides up over the photo (like Atlys's visa page), with sticky tabs that follow the
 * scroll. Home's city card grows into this screen and shrinks back into its card (CityOpenOverlay).
 */
export default function CityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const city = getCity(id);
  const info = getCityInfo(id);
  const { state } = useTrips();
  const { collected, kept, locals } = useCityPlaces(id);
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const top = insets.top + TOP_STRIP;
  // Scroll distance from "panel resting" to "panel up against the top strip".
  const rise = H - restPeek(insets.bottom) - top;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const sectionYs = useSharedValue<number[]>([]);
  const sectionYsRef = useRef<number[]>([]);
  const [active, setActive] = useState(0);
  const [barOn, setBarOn] = useState(false);
  // The safety bar fills the first time Good to know becomes the active tab.
  const [seenSafety, setSeenSafety] = useState(false);
  if (active === 3 && !seenSafety) setSeenSafety(true);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  const maxScroll = useSharedValue(Infinity);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
    maxScroll.set(e.contentSize.height - e.layoutMeasurement.height);
  });

  // Scroll-spy: the section under the tabs is the active tab. The last section is shorter than the
  // screen, so its heading can never reach the tabs; scrolled to the end counts as reaching it.
  useAnimatedReaction(
    () => {
      const y = scrollY.get();
      const ys = sectionYs.get();
      if (ys.length > 0 && y > rise && y >= maxScroll.get() - 24) return ys.length - 1;
      // A section counts as arrived once its heading has cleared the tabs, not its first pixel —
      // otherwise the heading you are reading and the tab that is lit disagree.
      const line = y + PANEL_HEADER_H + 64;
      let idx = 0;
      for (let i = 0; i < ys.length; i++) if (ys[i] !== undefined && ys[i] <= line) idx = i;
      return idx;
    },
    (idx, prev) => {
      if (idx !== prev) scheduleOnRN(setActive, idx);
    },
  );
  // The sticky bar takes over from the round button once the panel is mostly up.
  useAnimatedReaction(
    () => scrollY.get() > rise * 0.6,
    (on, prev) => {
      if (on !== prev) scheduleOnRN(setBarOn, on);
    },
  );

  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      opacity: interpolate(y, [0, rise * 0.55], [1, 0], Extrapolation.CLAMP),
      // Drifts up slower than the panel, so the panel visibly slides over it.
      transform: [{ translateY: y * 0.45 }, { scale: interpolate(y, [0, rise], [1, 0.94], Extrapolation.CLAMP) }],
    };
  });
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, rise], [0, 1], Extrapolation.CLAMP),
  }));
  const barStyle = useAnimatedStyle(() => {
    const t = interpolate(scrollY.get(), [rise * 0.5, rise * 0.8], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ translateY: (1 - t) * 24 }] };
  });

  if (!city || !info) return null;

  const collection = state.collections[id];
  const planned = !!state.savedTrips[id];
  const places = collection?.placeIds.length ?? 0;
  const reels = collection?.reelIds.length ?? 0;
  const plan = buildPlan([...kept, ...locals].length ? [...kept, ...locals] : collected);

  const start = () => router.push({ pathname: planned ? '/plan/[id]' : '/pick/[id]', params: { id } });

  // Sections measure themselves inside the panel body; store them in scroll-content coordinates.
  const setSectionY = (i: number, y: number) => {
    sectionYsRef.current[i] = rise + PANEL_HEADER_H + y;
    sectionYs.set([...sectionYsRef.current]);
  };

  // Lower the panel first, so the page shrinks back into its card from the same resting layout it
  // grew into (the growing card only knows that one).
  const back = () => {
    const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
    if (scrollY.get() < 8) return leave();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setTimeout(leave, 320);
  };

  // Tapping a tab raises the panel if needed and brings that section under the tabs. The tab lights
  // on the tap rather than when the scroll settles — the icon's motion is the feedback for the
  // press, so waiting for scroll-spy to catch up would read as a dropped tap. The spy corrects it
  // afterwards if the scroll lands somewhere else.
  const goToTab = (i: number) => {
    haptic.selection();
    setActive(i);
    const y = (sectionYsRef.current[i] ?? rise + PANEL_HEADER_H) - PANEL_HEADER_H;
    scrollRef.current?.scrollTo({ y: Math.max(y, rise), animated: true });
  };

  return (
    <View style={styles.fill}>
      <Image source={city.hero} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      <HeroScrim />
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />

      <Animated.ScrollView
        ref={scrollRef}
        style={[styles.scroll, { top }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        // Rest or fully up; past that, the panel's content scrolls freely.
        snapToOffsets={[0, rise]}
        snapToEnd={false}
        decelerationRate="fast"
      >
        {/* Transparent over the photo; holds the title and the round button, which drift and fade. */}
        <View style={{ height: rise }}>
          <Animated.View style={[styles.hero, { top: -top, width: W, height: H }, heroStyle]}>
            <CityHeroContent
              city={city}
              stats={{ places, reels, planned }}
              width={W}
              height={H}
              insetTop={insets.top}
              insetBottom={insets.bottom}
              onStart={start}
              hideBack
            />
          </Animated.View>
        </View>

        <PanelTabs active={active} onTab={goToTab} />

        <View style={[styles.panelBody, { paddingBottom: insets.bottom + 120, minHeight: H - top }]}>
          <OverviewSection cityName={city.name} info={info} onLayout={(e) => setSectionY(0, e.nativeEvent.layout.y)} />
          <PlacesSection places={collected} cityId={id} onLayout={(e) => setSectionY(1, e.nativeEvent.layout.y)} />
          <PlanSection plan={plan} planned={planned} onLayout={(e) => setSectionY(2, e.nativeEvent.layout.y)} />
          <GoodToKnowSection
            cityName={city.name}
            info={info}
            play={seenSafety}
            onLayout={(e) => setSectionY(3, e.nativeEvent.layout.y)}
          />
        </View>
      </Animated.ScrollView>

      <View style={[styles.back, { top: insets.top + 8 }]}>
        <IconButton icon="chevron-left" onPress={back} accessibilityLabel="Back to your cities" />
      </View>

      <Animated.View
        style={[styles.bar, { paddingBottom: insets.bottom + 12, pointerEvents: barOn ? 'auto' : 'none' }, barStyle]}
      >
        <View style={styles.barText}>
          <Text variant="bodyStrong">
            {places} {places === 1 ? 'place' : 'places'} from {reels} {reels === 1 ? 'video' : 'videos'}
          </Text>
          <Text variant="data">
            {formatRupees(info.costPerDay.low)} – {formatRupees(info.costPerDay.high)} a day
          </Text>
        </View>
        <Button compact label={planned ? 'See your day' : 'Start planning'} onPress={start} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  dim: { backgroundColor: 'rgba(0,0,0,0.35)', pointerEvents: 'none' },
  scroll: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  hero: { position: 'absolute', left: 0 },
  panelBody: { backgroundColor: light.panel },
  back: { position: 'absolute', left: 16 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: light.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: light.line,
    boxShadow: shadows.panel,
  },
  barText: { flex: 1, gap: 2 },
});
