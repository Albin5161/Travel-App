import { Feather } from '@expo/vector-icons';
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
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { getCity, getReel } from '@/data/api';
import { haptic } from '@/lib/haptics';
import { EASE_OUT, SPRING_SHEET } from '@/lib/motion';
import { useCityPlaces, useTrips } from '@/state/trips';
import { colors } from '@/theme/tokens';

const PANEL_H = 250;

export default function CityScreen() {
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
      </Animated.View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(13,15,14,0.7)', 'rgba(13,15,14,0)']}
        style={[styles.topFade, { height: insets.top + 90 }]}
      />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <PressableScale
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Back to your places"
        >
          <Feather name="chevron-left" size={22} color={colors.mist} />
        </PressableScale>
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(13,15,14,0)', 'rgba(13,15,14,0.92)', colors.night]}
        locations={[0, 0.35, 1]}
        style={[styles.bottomFade, { height: panelBottom + 80 }]}
      />
      <Animated.View style={[styles.panel, { paddingBottom: insets.bottom + 16 }, panelStyle]}>
        <Text variant="micro">
          {collected.length} places{firstReel ? ` · from ${firstReel.creator}` : ''}
        </Text>
        <Text variant="display">{city.name}</Text>
        <Text variant="body">Tap a pin to see a place, or go through them one by one.</Text>
        <Button
          label={`Review ${collected.length} places`}
          onPress={() => router.push({ pathname: '/pick/[id]', params: { id } })}
          style={styles.cta}
        />
        <Button
          kind="text"
          label={`Plan my day with ${kept} places`}
          trailingArrow
          onPress={() => router.push({ pathname: '/plan/[id]', params: { id } })}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.night },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  topBar: { position: 'absolute', left: 16, top: 0 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassDark,
    borderWidth: 1,
    borderColor: colors.rim,
  },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, gap: 8 },
  cta: { marginTop: 12 },
});
