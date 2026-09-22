import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityTile } from '@/components/CityTile';
import { LinkBox } from '@/components/LinkBox';
import { Text } from '@/components/Text';
import { getCity } from '@/data/api';
import { reels } from '@/data/catalog';
import { fadeUp } from '@/lib/motion';
import { useTrips } from '@/state/trips';
import { fonts, light, shadows } from '@/theme/tokens';

const ENTER = [0, 1, 2, 3].map((i) => fadeUp(120 + i * 60));
const SAMPLE_CITIES = ['gokarna', 'kochi', 'meghalaya'];
const GUTTER = 16;
const GAP = 12;

// Home is Collect mode: paste reels, watch cities fill up. Tapping a city opens Plan mode.
export default function Home() {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { state, dispatch } = useTrips();
  const hasLink = useClipboardLink();
  const startLink = useStartFromLink();
  // Remount the box on each start so a stale value or error isn't waiting on return.
  const [boxKey, setBoxKey] = useState(0);
  const start = (url: string) => {
    setBoxKey((k) => k + 1);
    startLink(url);
  };

  const collections = Object.values(state.collections).sort((a, b) => b.addedAt - a.addedAt);
  const empty = collections.length === 0;
  const fresh = state.freshCityId;
  const tileW = (W - GUTTER * 2 - GAP) / 2;

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => dispatch({ type: 'clearFresh' }), 600);
    return () => clearTimeout(t);
  }, [dispatch, fresh]);

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <LinearGradient colors={[light.canvasTop, light.canvas]} style={styles.wash} pointerEvents="none" />
      <ScrollView
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 12 }}
      >
        <View style={styles.header}>
          <Text style={styles.wordmark}>Raahi</Text>
          <Animated.View entering={ENTER[0]}>
            <Text style={styles.question}>which reel is{'\n'}your next trip?</Text>
          </Animated.View>
        </View>

        <Animated.View entering={ENTER[1]} style={styles.sticky}>
          <LinkBox key={boxKey} onSubmit={start} clipboardHasLink={hasLink} />
        </Animated.View>

        <Animated.View entering={ENTER[2]} style={[styles.panel, { paddingBottom: insets.bottom + 32 }]}>
          <Text variant="micro" style={styles.panelTitle}>
            {empty ? 'Or try a sample' : `Your cities · ${collections.length}`}
          </Text>
          <View style={styles.grid}>
            {empty
              ? SAMPLE_CITIES.map((id) => {
                  const city = getCity(id);
                  const reel = Object.values(reels).find((r) => r.cityId === id);
                  if (!city || !reel) return null;
                  return (
                    <CityTile
                      key={id}
                      width={tileW}
                      name={city.name}
                      photo={city.hero}
                      badge="Sample"
                      statLabel="Spots"
                      statValue={String(reel.placeIds.length)}
                      captionLabel="Sample reel by"
                      captionValue={reel.creator}
                      onPress={() => start(`https://youtu.be/sample-${id}`)}
                      accessibilityLabel={`Try the ${city.name} sample reel`}
                    />
                  );
                })
              : collections.map((c) => {
                  const city = getCity(c.cityId);
                  if (!city) return null;
                  const planned = !!state.savedTrips[c.cityId];
                  const nReels = c.reelIds.length;
                  return (
                    <Animated.View key={c.cityId} entering={c.cityId === fresh ? ENTER[3] : undefined}>
                      <CityTile
                        width={tileW}
                        name={city.name}
                        photo={city.hero}
                        statLabel="Spots"
                        statValue={String(c.placeIds.length)}
                        captionLabel={planned ? 'Day planned' : 'Collected from'}
                        captionValue={planned ? 'Ready to go' : `${nReels} ${nReels === 1 ? 'reel' : 'reels'}`}
                        onPress={() => router.push(`/city/${city.id}`)}
                        accessibilityLabel={`${city.name}, ${c.placeIds.length} spots`}
                      />
                    </Animated.View>
                  );
                })}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// hasUrlAsync reads no content, so iOS shows no paste prompt; the system Paste button does the reading.
function useClipboardLink() {
  const [hasLink, setHasLink] = useState(false);
  const check = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    Clipboard.hasUrlAsync()
      .then(setHasLink)
      .catch(() => setHasLink(false));
  }, []);
  useFocusEffect(check);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [check]);
  return hasLink;
}

function useStartFromLink() {
  const { dispatch } = useTrips();
  return (url: string) => {
    dispatch({ type: 'setPendingLink', url });
    router.push('/analysing');
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 240 },
  header: { paddingHorizontal: GUTTER, paddingBottom: 28 },
  wordmark: { fontFamily: fonts.serif, fontSize: 24, color: light.ink },
  question: {
    marginTop: 40,
    fontFamily: fonts.serif,
    fontSize: 32,
    lineHeight: 36,
    textAlign: 'center',
    color: light.ink,
    letterSpacing: -0.3,
  },
  sticky: {
    paddingHorizontal: GUTTER,
    paddingTop: 8,
    backgroundColor: light.canvas,
  },
  panel: {
    flex: 1,
    marginTop: 8,
    paddingTop: 22,
    paddingHorizontal: GUTTER,
    backgroundColor: light.panel,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    boxShadow: shadows.panel,
  },
  panelTitle: { marginBottom: 16, marginLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: 22 },
});
