import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  Easing,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INTRO_CTA, INTRO_MS, IntroScene, type PickId } from '@/components/onboarding/IntroScene';
import { ProfilePreview } from '@/components/onboarding/ProfilePreview';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { Sky } from '@/components/sky/Sky';
import { Text } from '@/components/Text';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { EASE_OUT } from '@/lib/motion';
import { useHomeSky } from '@/state/sky';
import { useTrips } from '@/state/trips';
import { skyFill, skyInk } from '@/theme/sky';
import { Tone } from '@/theme/tone';
import { fonts, space } from '@/theme/tokens';

const GUTTER = space.screen;
/** The zoom from the Earth into the map: slow away, slow to land. */
const ZOOM_EASE = Easing.bezier(0.5, 0, 0.25, 1);
/** The step after the scene's four beats: your name. */
const NAME = 4;

/**
 * One scene, then your name. The scene says what Xplore does by doing it once: you pick one of
 * three things you might have saved (a reel, a YouTube video, a photo post), the Earth turns to
 * where it is, its places land on the map, and they become a day (components/onboarding/IntroScene).
 * One tap a step, and each step grows out of the one before.
 *
 * The screen sits on the sky as it is right now (state/sky), the same sky Home opens on.
 *
 * The name is required: it's how friends see you on a shared plan, so sharing never has to ask.
 * Skip goes straight to it. `?step=name` opens on it (someone who skipped it before the name was
 * required), and `&then=back` returns to where they came from instead of Home. `?again=1` is the
 * scene on its own, from Profile, for watching it again: no name, and it closes back to Profile.
 */
export default function Onboarding() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const { step: asked, then, again } = useLocalSearchParams<{ step?: string; then?: string; again?: string }>();
  const replay = again === '1';
  const first = asked === 'name' && !replay ? NAME : 0;
  const [step, setStep] = useState(first);
  const [pick, setPick] = useState<PickId>('reel');
  const [name, setName] = useState(state.myName ?? '');
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

  // The room the scene has, between the top bar and the button: measured, since a phone browser's
  // own bars leave far less than the window height suggests.
  const [topEnd, setTopEnd] = useState(0);
  const [bottomStart, setBottomStart] = useState(0);
  // The scene keeps to that room and is clipped to it: the Earth is far larger than the screen at
  // both ends of its move, and would otherwise run under the bar and the button.
  const sceneH = bottomStart - topEnd;
  const frame = topEnd && bottomStart ? { top: 8, bottom: sceneH - 12 } : null;

  // With Reduce Motion nothing travels: the scene dips out, changes, and comes back.
  const veil = useSharedValue(0);
  // A tap is never refused while the scene is moving: the move carries on from wherever it is to
  // the new step, since every part of it reads the one value.
  const go = (next: number) => {
    setStep(next);
    if (reduced) {
      veil.set(withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 220 })));
      s.set(withDelay(150, withTiming(next, { duration: 1 })));
      nameOn.set(withDelay(150, withTiming(next === NAME ? 1 : 0, { duration: 220 })));
      return;
    }
    // Forward takes its time; back is quick. Into the map the move eases in and out again: a
    // gentle start, the fastest part through the middle of the zoom, and a long settle on the map.
    const ms = next > step ? (INTRO_MS[next] ?? 600) : 600;
    s.set(withTiming(next, { duration: ms, easing: next === 2 && next > step ? ZOOM_EASE : EASE_OUT }));
    nameOn.set(withTiming(next === NAME ? 1 : 0, { duration: next === NAME ? ms : 200, easing: EASE_OUT }));
  };

  const named = !!name.trim();
  const finish = () => {
    if (!named) return;
    haptic.success();
    dispatch({ type: 'setMyName', name });
    dispatch({ type: 'finishOnboarding' });
    track('onboarding completed', { named: true, skipped: skipped.current, picked: pick });
    if (then === 'back' && router.canGoBack()) router.back();
    else router.replace('/');
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Skipping skips the scene, not the name.
  const skip = () => {
    if (replay) return close();
    skipped.current = true;
    setStep(NAME);
    gone.set(withTiming(1, { duration: 180 }));
    s.set(withDelay(180, withTiming(NAME, { duration: 1 })));
    nameOn.set(withDelay(180, withTiming(1, { duration: 300, easing: EASE_OUT })));
  };
  const next = () => {
    if (step === NAME) return finish();
    haptic.light();
    if (step === NAME - 1 && replay) return close();
    go(step + 1);
  };

  const onName = step === NAME;
  const sceneStyle = useAnimatedStyle(() => ({
    opacity: (1 - gone.get()) * (1 - veil.get()) * interpolate(s.get(), [3.2, 3.8], [1, 0], Extrapolation.CLAMP),
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOn.get(),
    transform: [{ translateY: lift.get() + (1 - nameOn.get()) * 16 }],
  }));
  const art = Math.round(Math.min(280, Math.max(170, H * 0.3)));
  const label = onName ? 'Paste a link of my own' : step === NAME - 1 && replay ? 'Done' : INTRO_CTA[step];

  return (
    <Tone value="sky">
    <View style={styles.fill}>
      <Sky phase={phase} shade={0.35} />

      {frame ? (
        <Animated.View style={[styles.scene, { top: topEnd, height: sceneH }, sceneStyle]} pointerEvents={onName ? 'none' : 'box-none'}>
          <IntroScene s={s} step={step} pick={pick} onPick={setPick} width={W} height={sceneH} frame={frame} />
        </Animated.View>
      ) : null}

      <View
        style={[styles.top, { paddingTop: insets.top + 6 }]}
        onLayout={(e) => setTopEnd(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
        pointerEvents="box-none"
      >
        <View style={styles.topRow}>
          {/* There's no swiping between steps, so past the first there's a way back. */}
          {step > 0 && !onName ? (
            <PressableScale onPress={() => go(step - 1)} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <Feather name="chevron-left" size={18} color={skyInk.soft} />
              <Text variant="label" color={skyInk.soft}>
                Back
              </Text>
            </PressableScale>
          ) : (
            <Text style={styles.wordmark}>Xplore</Text>
          )}
          {onName ? null : (
            <PressableScale
              onPress={skip}
              style={styles.skip}
              accessibilityRole="button"
              accessibilityLabel={replay ? 'Close' : 'Skip to your name'}
            >
              <Text variant="label" color={skyInk.soft}>
                {replay ? 'Close' : 'Skip'}
              </Text>
            </PressableScale>
          )}
        </View>
        <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: replay ? NAME : NAME + 1, now: step + 1 }}>
          {Array.from({ length: replay ? NAME : NAME + 1 }, (_, i) => (
            <Segment key={i} index={i} s={s} />
          ))}
        </View>
      </View>

      <View style={styles.viewport} pointerEvents="box-none">
        <Animated.View style={[styles.namePage, nameStyle]} pointerEvents={onName ? 'auto' : 'none'}>
          {/* The invite a friend would get is a paper card: it keeps the light palette on the sky. */}
          <Tone value="light">
            <View style={[styles.art, { height: art }]}>
              <Fit height={art}>
                <ProfilePreview active={onName} name={name} />
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
            <NameField value={name} onChange={setName} onDone={finish} />
          </View>
        </Animated.View>
      </View>

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}
        onLayout={(e) => setBottomStart(e.nativeEvent.layout.y)}
      >
        <Button
          trailingArrow
          label={label}
          onPress={next}
          disabled={onName && !named}
          accessibilityHint={onName ? (named ? 'Opens the app, ready for your first link' : 'Add your first name first') : undefined}
        />
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

/** One step of the bar at the top: it fills as the scene moves into that step. */
function Segment({ index, s }: { index: number; s: SharedValue<number> }) {
  // Scaled from its left end, not resized: a transform costs no layout.
  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(s.get(), [index - 1, index], [0, 1], Extrapolation.CLAMP) }],
  }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, index === 0 ? null : fill]} />
    </View>
  );
}

/** White status bar over the sky, dark again for the paper screens after. */
function lightStatusBar() {
  setStatusBarStyle('light');
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
  consentLinks: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: -8, marginBottom: -14 },
  consentTap: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center' },
  consentLink: { color: skyInk.soft, textDecorationLine: 'underline' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingRight: 8, marginLeft: -4 },
  fill: { flex: 1 },
  top: { paddingHorizontal: GUTTER, paddingBottom: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  wordmark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.9, color: skyInk.strong },
  // Real padding, not hitSlop: the web ignores hitSlop, and a tap target should be 44pt tall.
  skip: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 5, marginTop: 2 },
  segment: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: skyInk.rim },
  segmentFill: { height: 3, width: '100%', backgroundColor: skyInk.strong, transformOrigin: 'left' },
  scene: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  viewport: { flex: 1, overflow: 'hidden' },
  namePage: { flex: 1, paddingHorizontal: GUTTER, justifyContent: 'center' },
  art: { alignItems: 'center', justifyContent: 'center' },
  words: { marginTop: 26, gap: 22 },
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
  copy: { gap: 12 },
  // The display size every screen title uses, so the intro and the app read as one voice.
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: skyInk.strong, letterSpacing: -1.1 },
  body: { paddingRight: 8 },
  bottom: { paddingHorizontal: GUTTER, gap: 16 },
});
