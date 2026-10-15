import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  Easing,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { INTRO_MS, IntroScene, PICK } from '@/components/onboarding/IntroScene';
import { ProfilePreview } from '@/components/onboarding/ProfilePreview';
import { ErrorNote } from '@/components/ErrorNote';
import { PressableScale } from '@/components/PressableScale';
import { Sky } from '@/components/sky/Sky';
import { Text } from '@/components/Text';
import { cities, reels } from '@/data/catalog';
import { track } from '@/lib/analytics';
import { useAccount } from '@/lib/live/account';
import { liveEnabled } from '@/lib/live/client';
import { haptic } from '@/lib/haptics';
import { nameProblem } from '@/lib/names';
import { EASE_OUT } from '@/lib/motion';
import { useIntroOver } from '@/state/inbox';
import { useHomeSky } from '@/state/sky';
import { useTrips } from '@/state/trips';
import { skyBar, skyDanger, skyFill, skyInk } from '@/theme/sky';
import { Tone } from '@/theme/tone';
import { fonts, radii, space } from '@/theme/tokens';

const GUTTER = space.screen;
/** The zoom from the Earth into the map: slow away, slow to land. */
const ZOOM_EASE = Easing.bezier(0.5, 0, 0.25, 1);
/** The step after the scene's four beats: your name. */
const NAME = 4;
/**
 * How long each beat stays once it has arrived before the scene moves on by itself, in ms: just
 * long enough to read its words, so the whole scene plays as one stretch rather than a set of stops.
 */
const HOLD_MS = [1500, 900, 1300, 2400];
/** The trip the scene follows, named on the invite at the end. */
const PLACE = cities[reels[PICK.reelId]?.cityId]?.name ?? 'Kochi';

/**
 * One scene, then your email (app/signin) and, after it, your name. The scene says what Xplore does by doing it once: something you saved
 * (a reel, a YouTube video, an Instagram post), the Earth turning to where it is, its places landing
 * on the map, and the day they make (components/onboarding/IntroScene).
 *
 * It plays by itself in one stretch once the opening animation is over: no buttons, and no bars
 * to wait on. Holding a finger down anywhere pauses it, and Skip moves on.
 *
 * Email first, then the name, as sign-ups do: the email says whether this is someone new or someone
 * back on another phone, whose name comes back with their backup and isn't asked again. So with
 * sign-in set up, the scene hands over to the email, and the tabs ask the name afterwards, only if
 * the account has none (`?step=name`). Without a backend there's no email: the scene goes to the name.
 * It waits while Terms or Privacy is open, and gives each beat longer with VoiceOver or TalkBack on.
 *
 * The screen sits on the sky as it is right now (state/sky), the same sky Home opens on.
 *
 * The name is required: it's how friends see you on a shared plan, so sharing never has to ask.
 * The keyboard's Go finishes it. `?step=name` opens on it (someone who skipped it before the name
 * was required), and `&then=back` returns to where they came from instead of Home. `?again=1` is
 * the scene on its own, from Profile, for watching it again: no name, and it closes by itself.
 */
export default function Onboarding() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const { step: asked, then, again } = useLocalSearchParams<{ step?: string; then?: string; again?: string }>();
  const replay = again === '1';
  const { account } = useAccount();
  const emailNext = liveEnabled && !account && !replay;
  const toEmail = () => {
    dispatch({ type: 'finishOnboarding' });
    track('intro finished', { skipped: skipped.current });
    router.replace('/signin');
  };
  const first = asked === 'name' && !replay ? NAME : 0;
  const [step, setStep] = useState(first);
  const [name, setName] = useState(state.myName ?? '');
  // What's wrong with the name (none, or numbers and symbols), said in red under the field when
  // Go is pressed, rather than only buzzing (nothing at all on the web). See lib/names.
  const [nameError, setNameError] = useState<string | null>(null);
  const skipped = useRef(false);
  const reduced = useReducedMotion();
  // Where the scene is, continuous: every moving part reads this one value (see IntroScene).
  const s = useSharedValue(first);
  // Skipping puts the scene away at once rather than running it fast.
  const gone = useSharedValue(0);
  const nameOn = useSharedValue(first === NAME ? 1 : 0);
  const lift = useKeyboardLift();
  const phase = useHomeSky();
  useFocusEffect(lightStatusBar);

  // The room the scene has, between the top bar and the foot: measured, since a phone browser's
  // own bars leave far less than the window height suggests.
  const [topEnd, setTopEnd] = useState(0);
  const [bottomStart, setBottomStart] = useState(0);
  // The scene keeps to that room and is clipped to it: the Earth is far larger than the screen at
  // both ends of its move, and would otherwise run under the bar and the foot.
  const sceneH = bottomStart - topEnd;
  const frame = topEnd && bottomStart ? { top: 8, bottom: sceneH - 12 } : null;

  // With Reduce Motion nothing travels: the scene dips out, changes, and comes back.
  const veil = useSharedValue(0);
  // The beat being played, for the timers, which outlive any one render.
  const at = useRef(first);
  const go = (next: number) => {
    const from = at.current;
    at.current = next;
    setStep(next);
    if (reduced) {
      veil.set(withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 220 })));
      s.set(withDelay(150, withTiming(next, { duration: 1 })));
      nameOn.set(withDelay(150, withTiming(next === NAME ? 1 : 0, { duration: 220 })));
      return;
    }
    // Into the map the move eases in and out again: a gentle start, the fastest part through the
    // middle of the zoom, and a long settle on the map.
    const ms = INTRO_MS[next] ?? 600;
    s.set(withTiming(next, { duration: ms, easing: next === 2 && next > from ? ZOOM_EASE : EASE_OUT }));
    nameOn.set(withTiming(next === NAME ? 1 : 0, { duration: next === NAME ? ms : 200, easing: EASE_OUT }));
  };

  const finish = () => {
    const problem = nameProblem(name);
    if (problem) {
      haptic.error();
      setNameError(problem);
      return;
    }
    haptic.success();
    dispatch({ type: 'setMyName', name });
    dispatch({ type: 'finishOnboarding' });
    track('onboarding completed', { named: true, skipped: skipped.current });
    if (then === 'back' && router.canGoBack()) router.back();
    else router.replace('/');
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // The clock: how far through the beat being played, 0 to 1, over its move in and its hold. It
  // fills that beat's bar at the top, and when it runs out the next beat comes.
  const beat = useSharedValue(0);
  const reader = useScreenReader();
  const slow = useRef(1);
  useEffect(() => {
    slow.current = reader ? 1.6 : 1;
  }, [reader]);
  const length = (i: number) => ((i === 0 ? 0 : (INTRO_MS[i] ?? 600)) + (HOLD_MS[i] ?? 3000)) * slow.current;
  const ended = (i: number) => {
    if (i !== at.current) return;
    if (i < NAME - 1) {
      go(i + 1);
      play(i + 1, 0);
    } else if (replay) close();
    else if (emailNext) toEmail();
    else go(NAME);
  };
  const play = (i: number, from: number) => {
    beat.set(from);
    beat.set(
      withTiming(1, { duration: length(i) * (1 - from), easing: Easing.linear }, (done) => {
        if (done) scheduleOnRN(ended, i);
      }),
    );
  };

  // It plays while the opening animation is over, this screen is in front (not Terms or Privacy),
  // and no finger is holding it.
  const [here, setHere] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setHere(true);
      return () => setHere(false);
    }, []),
  );
  const introOver = useIntroOver();
  const [held, setHeld] = useState(false);
  const onName = step === NAME;
  const playing = introOver && here && !held && !onName;
  useEffect(() => {
    if (!playing) return;
    play(at.current, beat.get());
    return () => cancelAnimation(beat);
    // Only starting and stopping: each beat starts the next itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Skipping skips the scene, not the name.
  const skip = () => {
    cancelAnimation(beat);
    if (replay) return close();
    skipped.current = true;
    if (emailNext) return toEmail();
    at.current = NAME;
    setStep(NAME);
    gone.set(withTiming(1, { duration: 180 }));
    s.set(withDelay(180, withTiming(NAME, { duration: 1 })));
    nameOn.set(withDelay(180, withTiming(1, { duration: 300, easing: EASE_OUT })));
  };

  // On the name, the keyboard comes up by itself: its Go is how the intro ends.
  const field = useRef<TextInput>(null);
  useEffect(() => {
    if (!onName) return;
    const t = setTimeout(() => field.current?.focus(), first === NAME ? 300 : 700);
    return () => clearTimeout(t);
  }, [onName, first]);

  const sceneStyle = useAnimatedStyle(() => ({
    opacity: (1 - gone.get()) * (1 - veil.get()) * interpolate(s.get(), [3.2, 3.8], [1, 0], Extrapolation.CLAMP),
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOn.get(),
    transform: [{ translateY: lift.get() + (1 - nameOn.get()) * 16 }],
  }));
  const art = Math.round(Math.min(280, Math.max(170, H * 0.3)));

  return (
    <Tone value="sky">
    <View style={styles.fill}>
      <Sky phase={phase} shade={0.35} />

      {/* Holding a finger anywhere on the scene pauses it, as on a story. */}
      {onName ? null : (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPressIn={() => setHeld(true)}
          onPressOut={() => setHeld(false)}
          accessible={false}
        />
      )}

      {frame ? (
        <Animated.View style={[styles.scene, { top: topEnd, height: sceneH }, sceneStyle]} pointerEvents={onName ? 'none' : 'box-none'}>
          <IntroScene s={s} step={step} width={W} height={sceneH} frame={frame} />
        </Animated.View>
      ) : null}

      <View
        style={[styles.top, { paddingTop: insets.top + 6 }]}
        onLayout={(e) => setTopEnd(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
        pointerEvents="box-none"
      >
        <View style={styles.topRow}>
          <Text style={styles.wordmark}>Xplore</Text>
          {onName ? null : (
            <PressableScale
              onPress={skip}
              style={styles.skip}
              accessibilityRole="button"
              accessibilityLabel={replay ? 'Close' : emailNext ? 'Skip the intro' : 'Skip to your name'}
            >
              <Text variant="label" color={skyInk.soft}>
                {replay ? 'Close' : 'Skip'}
              </Text>
            </PressableScale>
          )}
        </View>
      </View>

      <View style={styles.viewport} pointerEvents="box-none">
        <Animated.View style={[styles.namePage, nameStyle]} pointerEvents={onName ? 'auto' : 'none'}>
          {/* The invite a friend would get is a paper card: it keeps the light palette on the sky. */}
          <Tone value="light">
            <View style={[styles.art, { height: art }]}>
              <Fit height={art}>
                <ProfilePreview active={onName} name={name} place={PLACE} />
              </Fit>
            </View>
          </Tone>
          <View style={styles.words}>
            <View style={styles.copy}>
              <Text style={styles.title} accessibilityRole="header">
                {'Your turn.\nWho’s planning?'}
              </Text>
              <Text variant="body" style={styles.body}>
                How friends see you on a shared plan. Tap the circle for a photo.
              </Text>
            </View>
            <View style={styles.fieldBlock}>
              <NameField
                ref={field}
                value={name}
                onChange={(v) => {
                  setName(v);
                  setNameError(null);
                }}
                onDone={finish}
                wrong={!!nameError}
              />
              {nameError ? (
                <ErrorNote style={styles.fieldHint}>{nameError}</ErrorNote>
              ) : (
                <Text variant="label" color={skyInk.faint} style={styles.fieldHint}>
                  {Platform.OS === 'web' ? 'Press Enter to start.' : 'Tap Go on the keyboard to start.'}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </View>

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}
        onLayout={(e) => setBottomStart(e.nativeEvent.layout.y)}
      >
        {/* On every step, wherever someone starts reading. The two links are taps of their own,
            44pt tall, rather than words inside the sentence. Not shown when watching it again. */}
        {replay ? null : (
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
        )}
      </View>
    </View>
    </Tone>
  );
}

/**
 * Whether VoiceOver or TalkBack is on: then nothing moves on by itself. A browser can't tell (the
 * web's answer is always yes), so there it plays.
 */
function useScreenReader() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((v) => alive && setOn(v));
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

/** White status bar over the sky, dark again for the paper screens after. */
function lightStatusBar() {
  setStatusBarStyle(skyBar);
  return () => setStatusBarStyle('dark');
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

// Web only: the browser's own focus ring is the system accent (orange); the field's own focused
// border shows focus instead. RN's types don't list 'none'.
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

function NameField({
  ref,
  value,
  onChange,
  onDone,
  wrong,
}: {
  ref: React.Ref<TextInput>;
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
  /** Go was pressed with no name: the border takes the error red. */
  wrong: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      value={value}
      onChangeText={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onSubmitEditing={onDone}
      // Go finishes the intro, and the keyboard stays until it does.
      submitBehavior="submit"
      placeholder="Your first name"
      placeholderTextColor={skyInk.faint}
      selectionColor={skyInk.strong}
      autoCapitalize="words"
      autoComplete="given-name"
      textContentType="givenName"
      maxLength={40}
      returnKeyType="go"
      style={[styles.nameInput, NO_FOCUS_RING, focused && styles.nameInputFocused, wrong && styles.nameInputWrong]}
      accessibilityLabel="Your first name"
    />
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

const styles = StyleSheet.create({
  consentBlock: { marginTop: 4 },
  consent: { textAlign: 'center' },
  consentLinks: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: -8, marginBottom: -16 },
  consentTap: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center' },
  consentLink: { color: skyInk.soft, textDecorationLine: 'underline' },
  fill: { flex: 1 },
  top: { paddingHorizontal: GUTTER, paddingBottom: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  wordmark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.9, color: skyInk.strong },
  // Real padding, not hitSlop: the web ignores hitSlop, and a tap target should be 44pt tall.
  skip: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  scene: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  viewport: { flex: 1, overflow: 'hidden' },
  namePage: { flex: 1, paddingHorizontal: GUTTER, justifyContent: 'center' },
  art: { alignItems: 'center', justifyContent: 'center' },
  words: { marginTop: 24, gap: 24 },
  nameInput: {
    height: 54,
    paddingHorizontal: 16,
    borderRadius: radii.field,
    backgroundColor: skyFill.raised,
    borderWidth: 1,
    borderColor: skyInk.rim,
    fontFamily: fonts.sansMedium,
    fontSize: 17,
    color: skyInk.strong,
  },
  nameInputFocused: { backgroundColor: skyFill.pressed, borderColor: skyInk.outline },
  nameInputWrong: { borderColor: skyDanger.line, borderWidth: 2 },
  copy: { gap: 12 },
  // The display size every screen title uses, so the intro and the app read as one voice.
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: skyInk.strong, letterSpacing: -1.1 },
  body: { paddingRight: 8 },
  fieldBlock: { gap: 8 },
  fieldHint: { paddingHorizontal: 16 },
  bottom: { paddingHorizontal: GUTTER, gap: 16 },
});
