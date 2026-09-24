import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityOpenOverlay, useCityOpen } from '@/components/CityOpenOverlay';
import { CityTile } from '@/components/CityTile';
import { LinkBox } from '@/components/LinkBox';
import { Text } from '@/components/Text';
import { Segmented } from '@/components/Segmented';
import { EXAMPLE_LINKS, getCity } from '@/data/api';
import { reels } from '@/data/catalog';
import { allDistricts } from '@/data/regions';
import type { Platform as SourcePlatform } from '@/data/types';
import { FADE_IN, fadeUp } from '@/lib/motion';
import { isNearHome, useTrips, type HomeTab } from '@/state/trips';
import { fonts, light, shadows } from '@/theme/tokens';

const ENTER = [0, 1, 2, 3].map((i) => fadeUp(120 + i * 60));
const GUTTER = 16;
/** The floating tab bar sits over the scroll, so the last row of tiles has to clear it. */
const TAB_BAR_CLEARANCE = 100;
const GAP = 10;
/** Three across. Tighter than two, and the grid reads as a collection rather than a shortlist. */
const COLUMNS = 3;

// Home is Collect mode: paste a video, check what it found, watch your collections fill up. The
// collections split the way the app does: Near Home (weekends) and Cities (trips). Tapping a card
// opens that place's page.
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

  const cityOpen = useCityOpen();
  const closeCity = cityOpen.close;
  // Back on home from a city (by any route): shrink the city page back into its card.
  useFocusEffect(closeCity);

  const collections = Object.values(state.collections).sort((a, b) => b.addedAt - a.addedAt);
  const near = collections.filter((c) => isNearHome(c.cityId, state.homeDistrictId));
  const away = collections.filter((c) => !isNearHome(c.cityId, state.homeDistrictId));
  const tab = state.homeTab;
  const shown = tab === 'near' ? near : away;
  const homeName = allDistricts.find((d) => d.id === state.homeDistrictId)?.name ?? 'home';
  // Offer the first example whose place isn't collected yet, so each tap shows something new.
  const example = EXAMPLE_LINKS.find((e) => !state.collections[e.cityId]) ?? EXAMPLE_LINKS[0];
  const fresh = state.freshCityId;
  const tileW = (W - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => dispatch({ type: 'clearFresh' }), 600);
    return () => clearTimeout(t);
  }, [dispatch, fresh]);

  return (
    <View style={styles.root}>
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
              <Text style={styles.question}>
                Which video is{'\n'}
                <Text style={styles.questionStrong}>your next trip?</Text>
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={ENTER[1]} style={styles.sticky}>
            <LinkBox key={boxKey} onSubmit={start} clipboardHasLink={hasLink} onExample={() => start(example.url)} />
          </Animated.View>

          <Animated.View entering={ENTER[2]} style={[styles.panel, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
            <Segmented
              value={tab}
              onChange={(t) => dispatch({ type: 'setHomeTab', tab: t })}
              options={[
                { key: 'near', label: 'Near Home', count: near.length },
                { key: 'cities', label: 'Cities', count: away.length },
              ]}
            />
            <Text variant="micro" style={styles.panelTitle}>
              My collections
            </Text>
            <Animated.View key={tab} entering={FADE_IN} style={styles.grid}>
              {shown.length === 0 ? (
                <Empty tab={tab} homeName={homeName} />
              ) : (
                shown.map((c) => {
                  const city = getCity(c.cityId);
                  if (!city) return null;
                  const planned = !!state.savedTrips[c.cityId];
                  const nReels = c.reelIds.length;
                  const sources = c.reelIds.map((id) => reels[id]).filter((r) => !!r);
                  return (
                    <Animated.View key={c.cityId} entering={c.cityId === fresh ? ENTER[3] : undefined}>
                      <CityTile
                        width={tileW}
                        name={city.name}
                        photo={city.hero}
                        statLabel="Spots"
                        statValue={String(c.placeIds.length)}
                        captionLabel={sourceLabel(sources.map((r) => r.platform))}
                        captionValue={creators(sources.map((r) => r.creator))}
                        sources={[...new Set(sources.map((r) => r.platform))]}
                        lifted={cityOpen.card?.city.id === city.id}
                        onPress={(rect) =>
                          cityOpen.open({
                            city,
                            rect,
                            face: { name: city.name, statLabel: 'Spots', statValue: String(c.placeIds.length) },
                            stats: { places: c.placeIds.length, reels: nReels, planned },
                          })
                        }
                        accessibilityLabel={`${city.name}, ${c.placeIds.length} spots`}
                      />
                    </Animated.View>
                  );
                })
              )}
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </View>
      <CityOpenOverlay
        card={cityOpen.card}
        progress={cityOpen.progress}
        from={cityOpen.from}
        reduced={cityOpen.reduced}
      />
    </View>
  );
}

/** "Instagram reel" or "YouTube video" for one source; "2 videos" once there are more. */
function sourceLabel(platforms: SourcePlatform[]) {
  if (platforms.length > 1) return `${platforms.length} videos`;
  return platforms[0] === 'youtube' ? 'YouTube video' : 'Instagram reel';
}

/** The first creator, then how many others: "@slowdays.kochi +1". */
function creators(handles: string[]) {
  const unique = [...new Set(handles)];
  return unique.length > 1 ? `${unique[0]} +${unique.length - 1}` : (unique[0] ?? '');
}

function Empty({ tab, homeName }: { tab: HomeTab; homeName: string }) {
  return (
    <View style={styles.empty}>
      <Text variant="headline">{tab === 'near' ? 'Nothing near home yet' : 'No cities yet'}</Text>
      <Text variant="body">
        {tab === 'near'
          ? `Save a video of a café, a waterfall or a drive around ${homeName}. It lands here, ready for a free Saturday.`
          : 'Paste a video of somewhere you want to go. Every place in it lands here, filed under its city.'}
      </Text>
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
  root: { flex: 1 },
  fill: { flex: 1, backgroundColor: light.canvas },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 240 },
  header: { paddingHorizontal: GUTTER, paddingBottom: 28 },
  wordmark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.9, color: light.ink },
  // Two weights, one line box: a quiet Medium lead-in, then the ask in ExtraBold. The weight change
  // does the emphasis a decorative italic used to.
  question: {
    marginTop: 40,
    fontFamily: fonts.displayMedium,
    fontSize: 32,
    lineHeight: 37,
    color: light.inkSoft,
    // Lighter weights need more air than heavy ones or the word spaces close up.
    letterSpacing: -0.5,
  },
  // Sized again on purpose: the nested Text is our own component, which would otherwise reset it
  // to body's 15/22 rather than inherit from the line around it.
  questionStrong: { fontFamily: fonts.display, fontSize: 32, lineHeight: 37, color: light.ink, letterSpacing: -1 },
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
  panelTitle: { marginTop: 22, marginBottom: 14, marginLeft: 4 },
  empty: { width: '100%', gap: 8, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: 18 },
});
