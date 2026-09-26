import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CityMap, fitCameraToRect, flyTo, useCamera } from '@/components/CityMap';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { GoogleMap } from '@/components/GoogleMap';
import { getCity, getReel, isLiveCity } from '@/data/api';
import { haptic } from '@/lib/haptics';
import { EASE_OUT, SPRING_SHEET } from '@/lib/motion';
import { useCityPlaces, useTrips } from '@/state/trips';
import { light, shadows } from '@/theme/tokens';

const PANEL_H = 270;

export default function CityMapScreen() {
  const { id, reveal } = useLocalSearchParams<{ id: string; reveal?: string }>();
  const city = getCity(id);
  const { collected } = useCityPlaces(id);
  const { state } = useTrips();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [revealing] = useState(reveal === '1');

  const panelBottom = PANEL_H + insets.bottom;
  const fit = fitCameraToRect(
    collected.map((p) => p.map),
    { w: W, h: H },
    { top: insets.top + 64, bottom: panelBottom },
  );
  const maxScale = fit.s * 1.6;
  const camera = useCamera(revealing && !reduced ? { ...fit, s: fit.s * 1.12 } : fit);
  const activeId = useSharedValue<string | null>(null);

  const mapOpacity = useSharedValue(revealing ? 0 : 1);
  const panel = useSharedValue(revealing ? 0 : 1);

  useEffect(() => {
    if (!revealing) return;
    mapOpacity.set(withTiming(1, { duration: 300, easing: EASE_OUT }));
    camera.s.set(withTiming(fit.s, { duration: 600, easing: EASE_OUT }));
    // Mount-only: the reveal plays once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRevealed = () => {
    haptic.light();
    panel.set(withSpring(1, SPRING_SHEET));
  };
  // A real city's places are Google's, so they go on Google's map, which has no pin drop to wait
  // for: the panel comes up once the map has had a moment to appear.
  const live = isLiveCity(id);
  useEffect(() => {
    if (!revealing || !live) return;
    const t = setTimeout(onRevealed, 500);
    return () => clearTimeout(t);
    // Mount-only, like the reveal above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      activeId.set(null);
    }, [activeId]),
  );

  const mapStyle = useAnimatedStyle(() => ({ opacity: mapOpacity.get() }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: panel.get(),
    transform: [{ translateY: (1 - panel.get()) * 40 }],
  }));

  if (!city) return null;

  const reelIds = state.collections[id]?.reelIds ?? [];
  const firstReel = reelIds[0] ? getReel(reelIds[0]) : undefined;
  const kept = collected.filter((p) => !state.skipped[p.id]).length;

  const openPin = (placeId: string) => {
    const place = collected.find((p) => p.id === placeId);
    if (!place) return;
    activeId.set(placeId);
    // Centre the pin in the strip of map left visible above the 72% sheet.
    const s = camera.s.get();
    const stripCy = insets.top / 2 + H * 0.14;
    flyTo(camera, { x: place.map[0], y: place.map[1] - (stripCy - H / 2) / s, s });
    router.push({ pathname: '/place/[id]', params: { id: placeId } });
  };

  return (
    <View style={styles.fill}>
      <Animated.View style={[StyleSheet.absoluteFill, mapStyle]}>
        {live ? (
          <GoogleMap
            pins={collected.map((p) => ({ id: p.id, name: p.name, coords: p.coords, photo: p.photo }))}
            width={W}
            height={H}
            padding={{ top: insets.top + 64, bottom: panelBottom }}
            onPinPress={(pid) => router.push({ pathname: '/place/[id]', params: { id: pid } })}
          />
        ) : (
          <CityMap
            city={city}
            pins={collected.map((p) => ({ id: p.id, place: p }))}
            width={W}
            height={H}
            camera={camera}
            maxScale={maxScale}
            activeId={activeId}
            reveal={revealing}
            revealDelay={reduced ? 0 : 450}
            onRevealed={revealing ? onRevealed : undefined}
            onPinPress={openPin}
          />
        )}
      </Animated.View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(245,244,241,0.85)', 'rgba(245,244,241,0)']}
        style={[styles.topFade, { height: insets.top + 90 }]}
      />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <IconButton
          icon="chevron-left"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityLabel="Back to your places"
        />
      </View>

      <Animated.View style={[styles.panel, { paddingBottom: insets.bottom + 16 }, panelStyle]}>
        <Text variant="micro">
          {collected.length} places{firstReel ? ` · from ${firstReel.creator}` : ''}
        </Text>
        <Text variant="display">{city.name}</Text>
        <Text variant="body">Tap a pin to see a place, or turn them into a plan.</Text>
        <Button
          label={state.tripPlans[id] ? 'Open your plan' : `Plan a trip with ${kept} places`}
          onPress={() =>
            router.push({ pathname: state.tripPlans[id] ? '/plan/[id]' : '/trip/[id]', params: { id } })
          }
          style={styles.cta}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.mapLand },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  topBar: { position: 'absolute', left: 16, top: 0 },
  // White panel resting on the map, like the Atlys sheet over its photo.
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 8,
    backgroundColor: light.panel,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    boxShadow: shadows.panel,
  },
  cta: { marginTop: 12 },
});
