import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { GroupVote } from '@/components/onboarding/GroupVote';
import { ProfilePreview } from '@/components/onboarding/ProfilePreview';
import { VideoToTrip } from '@/components/onboarding/VideoToTrip';
import { WeekendRoute } from '@/components/onboarding/WeekendRoute';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { Chips } from '@/components/spots/Chips';
import { allDistricts } from '@/data/regions';
import { haptic } from '@/lib/haptics';
import { EASE_OUT, project, SPRING_DRAG } from '@/lib/motion';
import { useTrips } from '@/state/trips';
import { fonts, light } from '@/theme/tokens';

const PAGES = 4;
const GUTTER = 28;

/**
 * Four screens. The first says what Xplore does, in one sentence and one moving picture: any video
 * of a place (a beach, a café, a restaurant) becomes pins on a map and a planned day. Someone who has never heard of the app should be
 * able to explain it after that screen alone. Then the two reasons it's worth keeping: plans the
 * group decides together, and spots near home that become weekends (where it asks where home is).
 * Last, your name and photo, shown as the invite a friend would get, so the reason is visible.
 *
 * Every illustration is a short loop that plays only while its page is on screen.
 */
export default function Onboarding() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const [page, setPage] = useState(0);
  const [name, setName] = useState(state.myName ?? '');
  // Position in pages, continuous. The finger writes it directly, so the pages track the drag
  // rather than snapping between states, and every derived animation reads this one value.
  const p = useSharedValue(0);
  const start = useSharedValue(0);
  const lift = useKeyboardLift();

  const art = Math.round(Math.min(290, Math.max(224, H * 0.34)));
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

  const finish = () => {
    haptic.success();
    if (name.trim()) dispatch({ type: 'setMyName', name });
    dispatch({ type: 'finishOnboarding' });
    router.replace('/');
  };

  const last = page === PAGES - 1;

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[light.canvasTop, light.canvas]} style={styles.wash} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.wordmark}>Xplore</Text>
        {last ? null : (
          <PressableScale onPress={finish} accessibilityRole="button" accessibilityLabel="Skip the intro">
            <Text variant="label" color={light.inkFaint}>
              Skip
            </Text>
          </PressableScale>
        )}
      </View>

      {/* Clipped: the row is four screens wide, and without this it stretches the whole layout
          to 4x the viewport — which silently moves every other control off the screen. */}
      <View style={styles.viewport}>
        <GestureDetector gesture={swipe}>
          <Row p={p} width={W} lift={lift}>
            <Page
              index={0}
              p={p}
              artHeight={art}
              art={<VideoToTrip active={page === 0} width={artW} height={art} />}
            >
              <Copy
                lead={'Saw it in a video?\n'}
                title="Go there for real."
                body="Paste an Instagram or YouTube link: a hidden beach, a new café, a street-food lane. Xplore finds the places it names, pins them on your map and plans the day around them."
              />
            </Page>

            <Page index={1} p={p} artHeight={art} art={<GroupVote active={page === 1} width={artW} />}>
              <Copy
                lead={'Going with friends?\n'}
                title="Decide together."
                body="Share the plan and everyone votes on each stop: keep it, swap it or drop it. No more forty messages about lunch."
              />
            </Page>

            <Page
              index={2}
              p={p}
              artHeight={art}
              art={<WeekendRoute active={page === 2} width={artW} homeName={homeName} />}
            >
              <Copy
                lead={'A spot near home?\n'}
                title="Weekend, sorted."
                body="Places close to home become ready-made day trips, with the drive and the cost worked out."
              />
              <View style={styles.district}>
                <Text variant="label" color={light.inkSoft}>
                  Where’s home? <Text variant="label" color={light.inkFaint}>Kerala for now</Text>
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

            <Page index={3} p={p} artHeight={art} art={<ProfilePreview active={page === 3} name={name} />}>
              <Copy
                lead={'Last thing.\n'}
                title="Who’s planning?"
                body="This is how you’ll appear when you share a plan. Tap the circle to add a photo."
              />
              <NameField value={name} onChange={setName} onDone={finish} />
            </Page>
          </Row>
        </GestureDetector>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Dots p={p} />
        <Button
          label={last ? 'Find my first trip' : 'Next'}
          onPress={() => (last ? finish() : go(page + 1))}
          accessibilityHint={last ? 'Opens the app, ready for your first video' : undefined}
        />
      </View>
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
      placeholderTextColor={light.inkFaint}
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
  art,
  artHeight,
  children,
}: {
  index: number;
  p: SharedValue<number>;
  art: ReactNode;
  artHeight: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
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
      <Animated.View style={[styles.art, { height: artHeight }, artStyle]}>{art}</Animated.View>
      <Animated.View style={[styles.words, copyStyle]}>{children}</Animated.View>
    </View>
  );
}

/** A lead-in in Medium, the payoff in ExtraBold: the same two-weight headline as home. */
function Copy({ lead, title, body }: { lead?: string; title: string; body: string }) {
  return (
    <View style={styles.copy}>
      <Text style={[styles.title, lead ? styles.titleLead : null]} accessibilityRole="header">
        {lead}
        {lead ? <Text style={styles.title}>{title}</Text> : title}
      </Text>
      <Text variant="body" style={styles.body}>
        {body}
      </Text>
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
  pageSlot: { flex: 1, paddingHorizontal: GUTTER, justifyContent: 'center' },
  art: { alignItems: 'center', justifyContent: 'center' },
  words: { marginTop: 30, gap: 22 },
  nameInput: {
    height: 54,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    fontFamily: fonts.sansMedium,
    fontSize: 17,
    color: light.ink,
  },
  nameInputFocused: { borderColor: light.lineStrong },
  district: { gap: 10 },
  districtChips: { marginHorizontal: -GUTTER, paddingLeft: GUTTER },
  copy: { gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 35, color: light.ink, letterSpacing: -1 },
  titleLead: { fontFamily: fonts.displayMedium, color: light.inkSoft, letterSpacing: -0.5 },
  body: { paddingRight: 8 },
  bottom: { paddingHorizontal: GUTTER, gap: 22 },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: 6, height: 6, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3, backgroundColor: light.ink },
});
