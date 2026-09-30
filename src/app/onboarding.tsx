import Feather from '@expo/vector-icons/Feather';
import { useFonts } from 'expo-font';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupVote } from '@/components/onboarding/GroupVote';
import { ProfilePreview } from '@/components/onboarding/ProfilePreview';
import { FromThisToThis } from '@/components/onboarding/FromThisToThis';
import { WeekendRoute } from '@/components/onboarding/WeekendRoute';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { Sky } from '@/components/sky/Sky';
import { Text } from '@/components/Text';
import { Chips } from '@/components/spots/Chips';
import { allDistricts } from '@/data/regions';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { EASE_OUT, project, SPRING_DRAG } from '@/lib/motion';
import { useHomeSky } from '@/state/sky';
import { useTrips } from '@/state/trips';
import { skyAccent, skyFill, skyInk } from '@/theme/sky';
import { Tone } from '@/theme/tone';
import { fonts, space } from '@/theme/tokens';

const PAGES = 4;
const GUTTER = space.screen;
/** The words sit this far under their illustration. */
const WORDS_GAP = 30;
/** Clear air kept at the bottom of a page, so the dots (which reach up into it) never cover its words. */
const DOTS_CLEAR = 24;
/** An illustration never gets less room than this; past it, the picture is scaled down instead. */
const MIN_ART = 140;

/**
 * Four screens. The first says what Xplore does in one line and one picture: a reel becomes pins on
 * a map and a planned day ("From this… …to this"). Then the two reasons it's worth keeping: plans
 * the group decides together, and spots near home that become weekends (where it asks where home
 * is). Last, your name and photo, shown as the invite a friend would get.
 *
 * The screen sits on the sky as it is right now (state/sky), the same sky Home opens on; the
 * illustrations stay paper, cards lifted off it and tilted in depth. Copy is kept to a line or two.
 *
 * The name is required: it's how friends see you on a shared plan, so sharing never has to ask.
 * Skip goes straight to it. `?step=name` opens on it (someone who skipped it before the name was
 * required), and `&then=back` returns to where they came from instead of Home.
 */
export default function Onboarding() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const { step, then } = useLocalSearchParams<{ step?: string; then?: string }>();
  const first = step === 'name' ? PAGES - 1 : 0;
  const [page, setPage] = useState(first);
  const [name, setName] = useState(state.myName ?? '');
  const skipped = useRef(false);
  // The height the pages have between the top bar and the dots, measured: a phone browser's own
  // bars leave far less than the window height suggests, so each page is fitted to this.
  const [slotH, setSlotH] = useState(0);
  // Position in pages, continuous. The finger writes it directly, so the pages track the drag
  // rather than snapping between states, and every derived animation reads this one value.
  const p = useSharedValue(first);
  const start = useSharedValue(0);
  const lift = useKeyboardLift();
  // The handwriting on page one: small, and not waited for (plain type stands in for a moment).
  useFonts({ CaveatNotes: require('../../assets/fonts/CaveatNotes.ttf') });
  const phase = useHomeSky();
  useFocusEffect(lightStatusBar);

  // The illustration's size when there's room for it; a page with more words gets less (see Page).
  const art = Math.round(Math.min(320, Math.max(236, H * 0.38)));
  const artW = W - GUTTER * 2;
  const homeName = allDistricts.find((d) => d.id === state.homeDistrictId)?.name ?? 'home';

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

  const named = !!name.trim();
  const finish = () => {
    if (!named) return;
    haptic.success();
    dispatch({ type: 'setMyName', name });
    dispatch({ type: 'finishOnboarding' });
    track('onboarding completed', { named: true, skipped: skipped.current });
    if (then === 'back' && router.canGoBack()) router.back();
    else router.replace('/');
  };
  // Skipping skips the reasons, not the name.
  const skip = () => {
    skipped.current = true;
    go(PAGES - 1);
  };

  const last = page === PAGES - 1;

  return (
    <Tone value="sky">
    <View style={styles.fill}>
      <Sky phase={phase} shade={0.35} />

      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        {/* Past the first page, a way back that isn't a swipe (a mouse can't swipe the pages). */}
        {page > 0 ? (
          <PressableScale onPress={() => go(page - 1)} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
            <Feather name="chevron-left" size={18} color={skyInk.soft} />
            <Text variant="label" color={skyInk.soft}>
              Back
            </Text>
          </PressableScale>
        ) : (
          <Text style={styles.wordmark}>Xplore</Text>
        )}
        {last ? null : (
          <PressableScale onPress={skip} style={styles.skip} accessibilityRole="button" accessibilityLabel="Skip to your name">
            <Text variant="label" color={skyInk.soft}>
              Skip
            </Text>
          </PressableScale>
        )}
      </View>

      {/* Clipped: the row is four screens wide, and without this it stretches the whole layout
          to 4x the viewport — which silently moves every other control off the screen. */}
      <View style={styles.viewport} onLayout={(e) => setSlotH(e.nativeEvent.layout.height)}>
        <GestureDetector gesture={swipe}>
          <Row p={p} width={W} lift={lift}>
            <Page
              index={0}
              p={p}
              slotH={slotH}
              artHeight={art}
              art={(h) => <FromThisToThis active={page === 0} width={artW} height={h} />}
            >
              <Copy
                eyebrow="Turn inspiration into a plan"
                lead={'Saw it in a video?\n'}
                accent="Go there"
                title=" for real."
                body="Paste an Instagram or YouTube link. Xplore pins every place in it and plans your day."
              />
            </Page>

            <Page index={1} p={p} slotH={slotH} artHeight={art} art={() => <Tilted turn={-1}><GroupVote active={page === 1} width={artW} /></Tilted>}>
              <Copy
                eyebrow="Plan with friends"
                lead={'Going with friends?\n'}
                accent="Decide"
                title=" together."
                body="Share the plan. Everyone keeps, swaps or drops each stop. No more forty messages about lunch."
              />
            </Page>

            <Page
              index={2}
              p={p}
              slotH={slotH}
              artHeight={art}
              art={() => <Tilted turn={1}><WeekendRoute active={page === 2} width={artW} homeName={homeName} /></Tilted>}
            >
              <Copy
                eyebrow="Weekends near home"
                lead={'A spot near home?\n'}
                accent="Weekend,"
                title=" sorted."
                body="Places near home become ready-made day trips, drive and cost worked out."
              />
              <View style={styles.district}>
                <Text variant="label" color={skyInk.soft}>
                  Where’s home? <Text variant="label" color={skyInk.faint}>Kerala for now</Text>
                </Text>
                <View style={styles.districtChips}>
                  <Chips
                    value={state.homeDistrictId}
                    onChange={(id) => id && dispatch({ type: 'setHomeDistrict', districtId: id })}
                    options={allDistricts.map((d) => ({ key: d.id as string | null, label: d.name }))}
                  />
                </View>
              </View>
            </Page>

            <Page index={3} p={p} slotH={slotH} artHeight={art} art={() => <ProfilePreview active={page === 3} name={name} />}>
              <Copy
                eyebrow="Your profile"
                lead={'Last thing.\n'}
                accent="Who’s"
                title=" planning?"
                body="How friends see you on a shared plan. Tap the circle for a photo."
              />
              <NameField value={name} onChange={setName} onDone={finish} />
            </Page>
          </Row>
        </GestureDetector>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Dots p={p} onPick={go} />
        <Button
          trailingArrow
          label={last ? 'Find my first trip' : 'Next'}
          onPress={() => (last ? finish() : go(page + 1))}
          disabled={last && !named}
          accessibilityHint={last ? (named ? 'Opens the app, ready for your first video' : 'Add your first name first') : undefined}
        />
        {/* On every page, wherever someone starts reading. The two links are taps of their own,
            44pt tall, rather than words inside the sentence. */}
        <View style={styles.consentBlock}>
          <Text variant="label" color={skyInk.faint} style={styles.consent}>
            By using Xplore you agree to its terms and privacy policy, and that you’re 18 or over.
          </Text>
          <View style={styles.consentLinks}>
            <PressableScale onPress={() => router.push('/terms')} style={styles.consentTap} accessibilityRole="link" accessibilityLabel="Terms of use">
              <Text variant="label" style={styles.consentLink}>
                Terms
              </Text>
            </PressableScale>
            <PressableScale onPress={() => router.push('/privacy')} style={styles.consentTap} accessibilityRole="link" accessibilityLabel="Privacy policy">
              <Text variant="label" style={styles.consentLink}>
                Privacy
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </View>
    </Tone>
  );
}

/** White status bar over the sky, dark again for the paper screens after. */
function lightStatusBar() {
  setStatusBarStyle('light');
  return () => setStatusBarStyle('dark');
}

/** A page's card laid back in depth, like page one's pair: tipped away at the top, turned a little. */
function Tilted({ turn, children }: { turn: 1 | -1; children: ReactNode }) {
  return (
    <View style={{ transform: [{ perspective: 800 }, { rotateX: '14deg' }, { rotateY: `${turn * 10}deg` }, { rotateZ: `${turn * -3}deg` }] }}>
      {children}
    </View>
  );
}



/**
 * How far to raise the pages so the focused field clears the keyboard. It follows the keyboard's
 * own timing, and only moves as much as it has to. Web leaves this to the browser.
 */
function useKeyboardLift() {
  const lift = useSharedValue(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const field = TextInput.State.currentlyFocusedInput();
      if (!field) return;
      field.measureInWindow((_x, y, _w, h) => {
        const bottom = y + h - lift.get();
        const target = Math.min(0, e.endCoordinates.screenY - 20 - bottom);
        lift.set(withTiming(target, { duration: e.duration || 250, easing: EASE_OUT }));
      });
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      lift.set(withTiming(0, { duration: e.duration || 250, easing: EASE_OUT }));
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [lift]);
  return lift;
}

function NameField({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onSubmitEditing={onDone}
      placeholder="Your first name"
      placeholderTextColor={skyInk.faint}
      selectionColor={skyInk.strong}
      autoCapitalize="words"
      autoComplete="given-name"
      textContentType="givenName"
      maxLength={40}
      returnKeyType="go"
      style={[styles.nameInput, focused && styles.nameInputFocused]}
      accessibilityLabel="Your first name"
    />
  );
}

/** The pages side by side, slid by the shared page position, and raised clear of the keyboard. */
function Row({
  p,
  width,
  lift,
  children,
}: {
  p: SharedValue<number>;
  width: number;
  lift: SharedValue<number>;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -p.get() * width }, { translateY: lift.get() }],
  }));
  return <Animated.View style={[styles.row, { width: width * PAGES }, style]}>{children}</Animated.View>;
}

/**
 * A page in two layers. The illustration sits deeper: it trails the swipe, shrinks and tilts away,
 * while the words move nearly with the finger. The difference is what gives the carousel depth.
 */
function Page({
  index,
  p,
  slotH,
  art,
  artHeight,
  children,
}: {
  index: number;
  p: SharedValue<number>;
  /** The page's measured height; 0 until it's known. */
  slotH: number;
  /** Draws the illustration for the height it's given. */
  art: (height: number) => ReactNode;
  /** The illustration's height when there's room for it. */
  artHeight: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  // The words take what they need and the illustration gets what's left, so nothing is cut off on
  // a short screen (a phone browser with its bars showing).
  const [wordsH, setWordsH] = useState(0);
  const room = slotH && wordsH ? slotH - wordsH - WORDS_GAP - DOTS_CLEAR : artHeight;
  const height = Math.round(Math.max(MIN_ART, Math.min(artHeight, room)));
  const artStyle = useAnimatedStyle(() => {
    const d = p.get() - index;
    const a = Math.min(Math.abs(d), 1);
    return {
      opacity: interpolate(Math.abs(d), [0, 0.75], [1, 0], Extrapolation.CLAMP),
      transform: reduced ? [] : [{ translateX: d * 150 }, { scale: 1 - a * 0.12 }, { rotate: `${-d * 5}deg` }],
    };
  });
  const copyStyle = useAnimatedStyle(() => {
    const d = p.get() - index;
    return {
      opacity: interpolate(Math.abs(d), [0, 0.6], [1, 0], Extrapolation.CLAMP),
      transform: reduced ? [] : [{ translateX: d * 36 }],
    };
  });
  return (
    <View style={styles.pageSlot}>
      {/* The illustrations are paper cards: they keep the light palette on the sky. */}
      <Tone value="light">
        <Animated.View style={[styles.art, { height }, artStyle]}>
          <Fit height={height}>{art(height)}</Fit>
        </Animated.View>
      </Tone>
      <Animated.View style={[styles.words, copyStyle]} onLayout={(e) => setWordsH(e.nativeEvent.layout.height)}>
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * Scales an illustration down, as a whole, when it's taller than the room it has. A transform
 * doesn't change layout, so measuring the natural size never feeds back into the scale.
 */
function Fit({ height, children }: { height: number; children: ReactNode }) {
  const [natural, setNatural] = useState(0);
  const scale = natural > height ? height / natural : 1;
  return (
    <View style={{ transform: [{ scale }] }} onLayout={(e) => setNatural(e.nativeEvent.layout.height)}>
      {children}
    </View>
  );
}

/**
 * A small spaced caption, then the question and its answer in white, the answer's first words in
 * ember so the eye lands on the promise.
 */
function Copy({
  eyebrow,
  lead,
  accent,
  title,
  body,
}: {
  eyebrow: string;
  lead: string;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.copy}>
      <Text variant="eyebrow" style={styles.eyebrow}>
        {eyebrow}
      </Text>
      <Text style={styles.title} accessibilityRole="header">
        {lead}
        <Text style={[styles.title, styles.accent]}>{accent}</Text>
        <Text style={styles.title}>{title}</Text>
      </Text>
      <Text variant="body" style={styles.body}>
        {body}
      </Text>
    </View>
  );
}

/** The page dots, each a 44pt tap to its page. */
function Dots({ p, onPick }: { p: SharedValue<number>; onPick: (page: number) => void }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: PAGES }, (_, i) => (
        <PressableScale
          key={i}
          onPress={() => onPick(i)}
          containerStyle={styles.dotTap}
          style={styles.dotSlot}
          accessibilityRole="button"
          accessibilityLabel={`Page ${i + 1} of ${PAGES}`}
        >
          <Dot index={i} p={p} />
        </PressableScale>
      ))}
    </View>
  );
}

function Dot({ index, p }: { index: number; p: SharedValue<number> }) {
  // The active dot stretches into a bar and warms to ember, the button's colour. It is absolutely positioned and childless, so animating
  // width costs no layout pass on anything else.
  const style = useAnimatedStyle(() => {
    const d = Math.abs(p.get() - index);
    return {
      width: interpolate(d, [0, 1], [20, 6], Extrapolation.CLAMP),
      opacity: interpolate(d, [0, 1], [1, 0.45], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(Math.min(d, 1), [0, 1], [skyAccent, skyInk.strong]),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  consentBlock: { marginTop: 4 },
  consent: { textAlign: 'center' },
  consentLinks: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: -8, marginBottom: -14 },
  consentTap: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center' },
  consentLink: { color: skyInk.soft, textDecorationLine: 'underline' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingRight: 8, marginLeft: -4 },
  fill: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingBottom: 8,
  },
  wordmark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.9, color: skyInk.strong },
  // Real padding, not hitSlop: the web ignores hitSlop, and a tap target should be 44pt tall.
  skip: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  viewport: { flex: 1, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
  pageSlot: { flex: 1, paddingHorizontal: GUTTER, justifyContent: 'center' },
  art: { alignItems: 'center', justifyContent: 'center' },
  words: { marginTop: WORDS_GAP, gap: 22 },
  nameInput: {
    height: 54,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: skyFill.raised,
    borderWidth: 1,
    borderColor: skyInk.rim,
    fontFamily: fonts.sansMedium,
    fontSize: 17,
    color: skyInk.strong,
  },
  nameInputFocused: { backgroundColor: skyFill.pressed, borderColor: skyInk.outline },
  // Clear air above (from the paragraph) and below (from the page dots), and the question close to its tags.
  district: { gap: 12, marginTop: 8, marginBottom: 24 },
  districtChips: { marginHorizontal: -GUTTER, paddingLeft: GUTTER },
  copy: { gap: 12 },
  eyebrow: { marginBottom: 2 },
  // The display size every screen title uses, so the intro and the app read as one voice.
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: skyInk.strong, letterSpacing: -1.1 },
  // Warmer and lighter than the button's ember, so it holds up as type on a dark sky.
  accent: { color: skyAccent },
  body: { paddingRight: 8 },
  bottom: { paddingHorizontal: GUTTER, gap: 16 },
  // 44pt tall to tap, drawn 6pt tall: the negative margins keep the layout as it was.
  dots: { flexDirection: 'row', alignSelf: 'center', height: 44, marginVertical: -19, alignItems: 'center' },
  dotTap: { height: 44, justifyContent: 'center' },
  dotSlot: { height: 44, paddingHorizontal: 3, justifyContent: 'center' },
  dot: { height: 6, borderRadius: 3, backgroundColor: skyInk.strong },
});
