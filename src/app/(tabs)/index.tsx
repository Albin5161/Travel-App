import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, type LayoutChangeEvent, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityOpenOverlay, useCityOpen } from '@/components/CityOpenOverlay';
import { CityTile } from '@/components/CityTile';
import { LinkBox } from '@/components/LinkBox';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { Segmented } from '@/components/Segmented';
import { Glass } from '@/components/sky/Glass';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { EXAMPLE_LINKS, getCity, getReel } from '@/data/api';
import { places, smallPhoto } from '@/data/catalog';
import { Button } from '@/components/Button';
import { ContinueCard } from '@/components/home/ContinueCard';
import { FoundSheet, LinkInbox } from '@/components/home/LinkInbox';
import { HomePicker } from '@/components/HomePicker';
import { GlassSheet } from '@/components/sky/GlassSheet';
import { RecapCard } from '@/components/home/RecapCard';
import { PhotoStrip } from '@/components/home/PhotoStrip';
import { allDistricts } from '@/data/regions';
import type { Platform as SourcePlatform } from '@/data/types';
import { platformOfLink, track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { FADE_IN, fadeUp } from '@/lib/motion';
import { isNearHome, useTrips, type HomeTab } from '@/state/trips';
import { useHomeSky } from '@/state/sky';
import { useHere } from '@/state/where';
import { SKY, skyFill, skyInk } from '@/theme/sky';
import { fonts, space } from '@/theme/tokens';

const ENTER = [0, 1, 2, 3].map((i) => fadeUp(120 + i * 60));
const GUTTER = space.screen;
/** Room kept clear at each end of the top row (the wordmark's width and a gap) for the centred chip. */
const TOP_SIDE = 88;
/** How far the photo strip tucks under the link box. */
const STRIP_TUCK = 22;
// First-run strip: one striking place from each sample video, so the promise is visual.
const INSPIRATION = ['meg-dawki', 'kochi-mural', 'gok-om', 'meg-falls', 'gok-halfmoon']
  .map((id) => places[id])
  .filter((p) => !!p)
  .map((p) => ({ id: p.id, photo: smallPhoto(p) }));
/** The floating tab bar sits over the scroll, so the last row of tiles has to clear it. */
const TAB_BAR_CLEARANCE = 100;
/** The hero's top space: never tighter than this, never emptier than that. */
const MIN_PAD = 28;
const MAX_PAD = 200;
/** How much of what's below the fold (collections, a plan to continue) the first screen shows. */
const PEEK = 110;
const GAP = 10;
/** Three across. Tighter than two, and the grid reads as a collection rather than a shortlist. */
const COLUMNS = 3;

// Home is Collect mode: paste a video, check what it found, watch your collections fill up. The
// collections split the way the app does: Near Home (weekends) and Cities (trips). Tapping a card
// opens that place's page. It sits on the sky as it is at home right now, with the collections on
// a glass card, the way a weather app sets its panels over the weather.
export default function Home() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { state, dispatch } = useTrips();
  const hasLink = useClipboardLink();
  const startLink = useStartFromLink();
  // Remount the box on each start so a stale value or error isn't waiting on return.
  const [boxKey, setBoxKey] = useState(0);
  const start = (url: string) => {
    setBoxKey((k) => k + 1);
    startLink(url);
  };
  // Several at once aren't watched one by one: they're read in the background and wait here.
  const startMany = (urls: string[]) => {
    setBoxKey((k) => k + 1);
    haptic.light();
    track('links pasted', { count: urls.length });
    dispatch({ type: 'inboxAdd', urls, from: 'paste' });
  };

  const phase = useHomeSky();
  const look = SKY[phase];
  const cityOpen = useCityOpen();
  const closeCity = cityOpen.close;
  // Back on home from a city (by any route): shrink the city page back into its card.
  useFocusEffect(closeCity);

  // The link box sticks at the top once scrolled to; from then on the collections pass under it,
  // so it frosts over (as a system bar does) only while something is actually behind it.
  const scrollY = useSharedValue(0);
  const [stickAt, setStickAt] = useState(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const frostStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [stickAt, stickAt + 24], [0, 1], Extrapolation.CLAMP),
  }));

  const collections = Object.values(state.collections).sort((a, b) => b.addedAt - a.addedAt);
  // Filed by where the places are, never picked: each collection lands in exactly one of the two.
  const near = collections.filter((c) => isNearHome(c.placeIds, state.homeDistrictId));
  const away = collections.filter((c) => !near.includes(c));
  const spotCount = collections.reduce((n, c) => n + c.placeIds.length, 0);
  const tab = state.homeTab;
  const shown = tab === 'near' ? near : away;
  const homeName = allDistricts.find((d) => d.id === state.homeDistrictId)?.name ?? null;
  const [pickingHome, setPickingHome] = useState(false);
  // First name only: the greeting is a hello, not a form letter. A name typed in capitals ("ALBIN")
  // is softened to "Albin" so the hello doesn't shout; any other spelling is kept as typed.
  const typedFirst = state.myName?.split(/\s+/)[0];
  const firstName =
    typedFirst && typedFirst.length > 1 && typedFirst === typedFirst.toUpperCase()
      ? typedFirst[0] + typedFirst.slice(1).toLowerCase()
      : typedFirst;
  // The strip over the link box: always the same few bundled photos (credited on the Credits page).
  // Your own places can't go here: their photos from Google and Wikimedia need a credit these small
  // prints can't carry, and a video's frames or thumbnail made a strip that changed with every
  // paste. Muted before the first save, when nothing is yours yet.
  const inspiration = collections.length === 0;
  const stripPhotos = INSPIRATION;
  const fresh = state.freshCityId;
  const tileW = (W - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  // The first screen is composed around its middle: the question, the prints and the link box sit
  // centred in the room above the tab bar (less a peek of what's below, when there is something),
  // instead of stacked from the top. Measured once and then held, so the page doesn't shift as a
  // phone browser's bars slide away while scrolling.
  const [viewH] = useState(H);
  const [sizes, setSizes] = useState({ top: 0, hero: 0, link: 0 });
  const measure = (k: keyof typeof sizes) => (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setSizes((m) => (m[k] === h ? m : { ...m, [k]: h }));
  };
  const below = collections.length > 0 || !!state.draft || state.inbox.length > 0 ? PEEK : 0;
  const room = viewH - insets.top - 12 - TAB_BAR_CLEARANCE - below;
  const heroPad =
    sizes.top && sizes.hero && sizes.link
      ? Math.round(Math.min(MAX_PAD, Math.max(MIN_PAD, (room - sizes.top - sizes.hero - sizes.link) / 2)))
      : null;

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => dispatch({ type: 'clearFresh' }), 600);
    return () => clearTimeout(t);
  }, [dispatch, fresh]);

  return (
    <SkyScreen>
      <View style={[styles.fill, { paddingTop: insets.top }]}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          stickyHeaderIndices={[1]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // iPhone: the page makes room for the keyboard and brings the link box above it.
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingTop: 12, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
        >
          <View style={styles.header} onLayout={(e) => setStickAt(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
            {/* The wordmark left, search right, and where you are in the middle, so the row balances. */}
            <View style={styles.topRow} onLayout={measure('top')}>
              <Text style={styles.wordmark}>Xplore</Text>
              {collections.length > 0 ? <SearchButton /> : null}
              <View style={styles.hereSlot} pointerEvents="box-none">
                <HereChip maxWidth={W - GUTTER * 2 - TOP_SIDE * 2} />
              </View>
            </View>
            {/* Hidden for the one frame before it's measured, so it appears already in place. Kept as
                a real view on phones (not collapsable): one that's only spacing is folded away once
                it's no longer see-through, and if that lands while the greeting below is still
                fading in (a slower phone), the greeting is redrawn at the screen's top-left corner,
                over the wordmark. */}
            <View
              collapsable={false}
              onLayout={measure('hero')}
              style={{ marginTop: heroPad ?? MIN_PAD, opacity: heroPad === null ? 0 : 1 }}
            >
            <Animated.View entering={ENTER[0]}>
              <Text style={styles.question} accessibilityRole="header">
                {firstName ? (
                  <>
                    {'Hey '}
                    <Text style={styles.questionName}>{firstName}</Text>
                    {',\nwhich video is\n'}
                  </>
                ) : (
                  'Which video is\n'
                )}
                <Text style={styles.questionStrong}>your next plan?</Text>
              </Text>
            </Animated.View>
            {/* Centred on the field, which now holds the paste button and runs the full width. */}
            <View style={styles.strip}>
              <PhotoStrip photos={stripPhotos} width={W - GUTTER * 2} muted={inspiration} />
            </View>
            </View>
          </View>

          <Animated.View entering={ENTER[1]} style={[styles.sticky, heroPad === null && styles.hidden]} onLayout={measure('link')}>
            <Animated.View style={[styles.frost, frostStyle]} pointerEvents="none">
              <Glass blur tint={look.glass} radius={0} style={styles.frostFill} />
            </Animated.View>
            <LinkBox key={boxKey} onSubmit={start} onSubmitMany={startMany} clipboardHasLink={hasLink} />
          </Animated.View>

          <View style={styles.continue}>
            <LinkInbox />
            <RecapCard />
            <ContinueCard />
          </View>

          {/* First run is just the question and the link box. The collections appear with the first
              save, fading up as it lands, rather than greeting a new user with two empty tabs. */}
          {collections.length === 0 ? null : (
            <Animated.View entering={ENTER[2]} style={styles.panelWrap}>
              <View style={styles.panelHead}>
                <Text variant="headline" accessibilityRole="header">
                  Your places
                </Text>
                <Text variant="label" color={skyInk.soft}>
                  {countLine(collections.length, spotCount)}
                </Text>
              </View>
              <Segmented
                value={tab}
                onChange={(t) => dispatch({ type: 'setHomeTab', tab: t })}
                options={[
                  { key: 'near', label: 'Near Home', count: near.length },
                  { key: 'cities', label: 'Cities', count: away.length },
                ]}
              />
              <Animated.View key={tab} entering={FADE_IN} style={styles.grid}>
                {shown.length === 0 ? (
                  <Empty tab={tab} homeName={homeName} onSetHome={() => setPickingHome(true)} />
                ) : (
                  shown.map((c) => {
                    const city = getCity(c.cityId);
                    if (!city) return null;
                    const planned = !!state.savedTrips[c.cityId];
                    const nReels = c.reelIds.length;
                    const sources = c.reelIds.map((id) => getReel(id)).filter((r) => !!r);
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
                          photoCredit={city.heroCredit}
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
          )}
        </Animated.ScrollView>
      </View>
      <HomePicker visible={pickingHome} onClose={() => setPickingHome(false)} />
      <FoundSheet />
      <CityOpenOverlay
        card={cityOpen.card}
        progress={cityOpen.progress}
        from={cityOpen.from}
        reduced={cityOpen.reduced}
      />
    </SkyScreen>
  );
}

/** "2 cities · 11 spots": what's saved, in a line beside the heading. */
function countLine(cities: number, spots: number) {
  return `${cities} ${cities === 1 ? 'city' : 'cities'} · ${spots} ${spots === 1 ? 'spot' : 'spots'}`;
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

/** Opens search over everything saved. Only there once something is. */
function SearchButton() {
  return (
    <PressableScale
      onPress={() => router.push('/search')}
      style={styles.searchButton}
      accessibilityRole="button"
      accessibilityLabel="Search your saved places"
    >
      <Feather name="search" size={16} color={skyInk.strong} />
    </PressableScale>
  );
}

/**
 * Where you are, as a town, like a delivery app's header. Asks for location only when tapped; the
 * town is worked out on the phone and the position goes nowhere (state/where).
 */
function HereChip({ maxWidth }: { maxWidth: number }) {
  const { here, find } = useHere();
  // The first tap says what location is for before the browser or phone asks for it.
  const [asking, setAsking] = useState(false);
  const label =
    here.status === 'found'
      ? (here.town ?? 'Location on')
      : here.status === 'finding'
        ? 'Finding you…'
        : here.status === 'off'
          ? 'Location off'
          : 'Use my location';
  const quiet = here.status === 'off' || here.status === 'finding';
  return (
    <>
    <PressableScale
      onPress={() => (here.status === 'unknown' ? setAsking(true) : find())}
      disabled={here.status === 'finding'}
      style={[styles.hereTap, { maxWidth }]}
      accessibilityRole="button"
      accessibilityLabel={here.status === 'found' && here.town ? `You're in ${here.town}. Tap to check again.` : label}
      accessibilityHint={here.status === 'unknown' ? 'Asks to use your location. It stays on your phone.' : undefined}
    >
      <View style={styles.herePill}>
        <Feather name="map-pin" size={13} color={quiet ? skyInk.faint : skyInk.strong} />
        <Text variant="label" color={quiet ? skyInk.faint : skyInk.strong} numberOfLines={1} style={styles.hereText}>
          {label}
        </Text>
      </View>
    </PressableScale>
    <GlassSheet visible={asking} onClose={() => setAsking(false)}>
      <View style={styles.askBody}>
        <Text variant="headline" accessibilityRole="header">
          Use your location?
        </Text>
        <Text variant="body">
          Your map then measures how far each place is from where you are, not from home. Your position stays on this phone.
        </Text>
        <Button
          label="Use my location"
          onPress={() => {
            setAsking(false);
            find();
          }}
        />
        <Button kind="text" label="Not now" onPress={() => setAsking(false)} />
      </View>
    </GlassSheet>
    </>
  );
}

function Empty({ tab, homeName, onSetHome }: { tab: HomeTab; homeName: string | null; onSetHome: () => void }) {
  if (tab === 'near' && !homeName) {
    return (
      <View style={styles.empty}>
        <Text variant="headline" accessibilityRole="header">Where’s home?</Text>
        <Text variant="body">
          Tell us, and places within reach of it land here, ready for a free Saturday.
        </Text>
        <Button kind="secondary" label="Set your home" onPress={onSetHome} style={styles.setHome} />
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <Text variant="headline" accessibilityRole="header">{tab === 'near' ? 'Nothing near home yet' : 'No cities yet'}</Text>
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
    track('link pasted', { platform: platformOfLink(url), example: EXAMPLE_LINKS.some((e) => e.url === url) });
    router.push('/analysing');
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: GUTTER },
  // The strip's lower edge runs under the sticky link box below it (a later sibling, so it draws
  // on top), which is what makes the prints read as tucked behind the field.
  strip: { marginTop: 14, marginBottom: -STRIP_TUCK },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  // Centred on the screen, not in the gap left over, whatever the two ends measure.
  hereSlot: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // A 44pt tap around the 34pt pill.
  // A pill of the same glass as the link box, so the header reads as one family of controls.
  hereTap: { height: 44, justifyContent: 'center' },
  herePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
    backgroundColor: skyFill.raised,
  },
  hereText: { flexShrink: 1 },
  // The chip's glass, round: 44pt, the size of every tap.
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
    backgroundColor: skyFill.raised,
  },
  wordmark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.9, color: skyInk.strong },
  // Two weights, one colour: a quiet Medium lead-in, then the name and the ask in ExtraBold. The
  // weight does the emphasis; a second colour on the last line is every generated landing page.
  question: {
    fontFamily: fonts.displayMedium,
    fontSize: 34,
    lineHeight: 38,
    color: skyInk.soft,
    // Lighter weights need more air than heavy ones or the word spaces close up.
    letterSpacing: -0.5,
  },
  // Sized again on purpose: the nested Text is our own component, which would otherwise reset it
  // to body's 15/22 rather than inherit from the line around it.
  questionStrong: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: skyInk.strong, letterSpacing: -1.1 },
  questionName: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: skyInk.strong, letterSpacing: -1.1 },
  hidden: { opacity: 0 },
  continue: { paddingHorizontal: GUTTER },
  // Clear at rest, so the prints disappear behind the field rather than behind a flat band.
  sticky: { paddingHorizontal: GUTTER },
  frost: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  frostFill: { flex: 1, borderWidth: 0 },
  // Straight on the sky, no card: the caption, the switch and the tiles, like a weather app's list.
  panelWrap: { marginTop: 16, paddingHorizontal: GUTTER, gap: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  empty: { width: '100%', gap: 8, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8 },
  setHome: { alignSelf: 'flex-start', marginTop: 4 },
  askBody: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: 18 },
});
