import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/group/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { Text } from '@/components/Text';
import { Chips } from '@/components/spots/Chips';
import { places } from '@/data/catalog';
import { allDistricts } from '@/data/regions';
import { haptic } from '@/lib/haptics';
import { project, SPRING_DRAG } from '@/lib/motion';
import { useTrips } from '@/state/trips';
import { fonts, light, shadows } from '@/theme/tokens';

const PAGES = 4;
const GUTTER = 28;

/**
 * Three screens, each a reason before a feature, then who you are.
 *
 * The three: First the problem everyone has (saved reels, no
 * trips), then what makes Xplore different (a plan the whole group agrees on), then the weekly
 * reason to come back (spots near home become weekends), which is where it asks the one thing it
 * needs: where home is. Last, your name and photo, so a plan you share says who it's from and you're
never asked at the moment of sharing. The how (paste a link, swipe to check) is left to the app itself, where
 * it's obvious. Permissions come later, in context, where the reason can be stated.
 */
export default function Onboarding() {
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const [page, setPage] = useState(0);
  const [name, setName] = useState(state.myName ?? '');
  // Position in pages, continuous. The finger writes it directly, so the pages track the drag
  // rather than snapping between states, and every derived animation reads this one value.
  const p = useSharedValue(0);
  const start = useSharedValue(0);

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
          <PressableScale onPress={finish} accessibilityRole="button" accessibilityLabel="Skip setup">
            <Text variant="label" color={light.inkFaint}>
              Skip
            </Text>
          </PressableScale>
        )}
      </View>

      {/* Clipped: the row is three screens wide, and without this it stretches the whole layout
          to 3x the viewport — which silently moves every other control off the screen. */}
      <View style={styles.viewport}>
        <GestureDetector gesture={swipe}>
          <Row p={p} width={W}>
        <Page index={0} p={p}>
          <ReelFan />
          <Copy
            lead={'You saved 200 reels.\n'}
            title="You’ve been to none."
            body="Xplore pulls the places out of the videos you save and turns them into trips you actually take."
          />
        </Page>

        <Page index={1} p={p}>
          <VotePreview />
          <Copy
            lead={'Plans your whole\ngroup '}
            title="agrees on."
            body="Share a plan and everyone keeps, swaps or drops each stop. No more forty messages to decide on lunch."
          />
        </Page>

        <Page index={2} p={p}>
          <WeekendPreview />
          <Copy
            lead={'The ones near\nhome become\n'}
            title="your weekends."
            body="Spots you save close by turn into Saturday outings, drive time worked out. So, where's home?"
          />
          <View style={styles.districtPicker}>
            <Chips
              value={state.homeDistrictId}
              onChange={(id) => id && dispatch({ type: 'setHomeDistrict', districtId: id })}
              options={allDistricts.map((d) => ({ key: d.id as string | null, label: d.name }))}
            />
          </View>
        </Page>

        <Page index={3} p={p}>
          <View style={styles.art}>
            <ProfilePhoto size={112} />
          </View>
          <Copy
            lead={'Last thing.\n'}
            title="Who's planning?"
            body="Friends see your name and photo when you share a trip with them. Tap the circle to add a photo."
          />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your first name"
            placeholderTextColor={light.inkFaint}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            maxLength={40}
            returnKeyType="done"
            style={styles.nameInput}
            accessibilityLabel="Your name"
          />
        </Page>
          </Row>
        </GestureDetector>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Dots p={p} />
        <Button label={last ? 'Start collecting' : 'Next'} onPress={() => (last ? finish() : go(page + 1))} />
      </View>
    </View>
  );
}

/** The three pages side by side, slid by the shared page position. */
function Row({ p, width, children }: { p: SharedValue<number>; width: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -p.get() * width }] }));
  return (
    <Animated.View style={[styles.row, { width: width * PAGES }, style]}>{children}</Animated.View>
  );
}

/** Each page's contents drift and fade against the swipe, so the pages feel stacked in depth. */
function Page({ index, p, children }: { index: number; p: SharedValue<number>; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const d = p.get() - index;
    return {
      opacity: interpolate(Math.abs(d), [0, 0.9], [1, 0], Extrapolation.CLAMP),
      // Contents move with the page but slower, so the pages read as stacked in depth.
      transform: reduced ? [] : [{ translateX: d * 46 }, { scale: 1 - Math.min(Math.abs(d), 1) * 0.06 }],
    };
  });
  return (
    <View style={styles.pageSlot}>
      <Animated.View style={[styles.page, style]}>{children}</Animated.View>
    </View>
  );
}

/** A lead-in in Medium, the payoff in ExtraBold: the same two-weight headline as home. */
function Copy({ lead, title, body }: { lead?: string; title: string; body: string }) {
  return (
    <View style={styles.copy}>
      <Text style={[styles.title, lead ? styles.titleLead : null]}>
        {lead}
        {lead ? <Text style={styles.title}>{title}</Text> : title}
      </Text>
      <Text variant="body" style={styles.body}>
        {body}
      </Text>
    </View>
  );
}

// The group vote in miniature: one stop, three friends, one of them pushing for a swap.
const VOTERS = [
  { member: { id: 'riya', name: 'Riya', tint: '#F4CDB0' }, emoji: '😍', fill: light.ink },
  { member: { id: 'kabir', name: 'Kabir', tint: '#C3DDD6' }, emoji: '🔥', fill: light.ink },
  { member: { id: 'meera', name: 'Meera', tint: '#DAD1F3' }, emoji: '🤔', fill: light.accent },
];

/** A stop in the group vote, as it looks in the app. */
function VotePreview() {
  const stop = places['gok-om'];
  return (
    <View style={styles.art}>
      <View style={styles.voteCard}>
        <View style={styles.voteHead}>
          <Image source={stop.photo} style={styles.voteThumb} contentFit="cover" transition={0} />
          <View style={styles.voteText}>
            <Text variant="bodyStrong">{stop.name}</Text>
            <Text variant="data">Sat · 5:30 PM</Text>
          </View>
          <View style={styles.votePill}>
            <Text style={styles.votePillText}>Keeping</Text>
          </View>
        </View>
        <View style={styles.voteBar}>
          {VOTERS.map((v) => (
            <View key={v.member.id} style={[styles.voteSlot, { backgroundColor: v.fill }]} />
          ))}
        </View>
        <View style={styles.voteChips}>
          {VOTERS.map((v) => (
            <View key={v.member.id} style={styles.voteChip}>
              <Avatar person={v.member} size={22} />
              <Text style={styles.voteEmoji}>{v.emoji}</Text>
            </View>
          ))}
        </View>
        <View style={styles.voteNote}>
          <Text variant="label">
            <Text variant="label" style={styles.voteNoteName}>
              Meera
            </Text>
            {'  '}What about Paradise Beach?
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Three saved reels, fanned like cards still waiting to be dealt. */
function ReelFan() {
  const shots = [places['ktm-kumarakom'], places['kochi-mural'], places['ktm-illickal']];
  return (
    <View style={styles.art}>
      {shots.map((p, i) => (
        <View
          key={p.id}
          style={[
            styles.fanCard,
            {
              transform: [
                { translateX: (i - 1) * 62 },
                { rotate: `${(i - 1) * 11}deg` },
                { translateY: Math.abs(i - 1) * 16 },
              ],
              zIndex: i === 1 ? 3 : 1,
            },
          ]}
        >
          <Image source={p.photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
          {i === 1 ? <View style={styles.fanPin} /> : null}
        </View>
      ))}
    </View>
  );
}

/** A weekend outing, exactly as it appears on the map tab. */
function WeekendPreview() {
  const shots = [places['ktm-illickal'], places['ktm-marmala']];
  return (
    <View style={styles.art}>
      <View style={styles.routeCard}>
        <View style={styles.routePhotos}>
          {shots.map((p, i) => (
            <Image
              key={p.id}
              source={p.photo}
              style={[styles.routePhoto, i > 0 && styles.routePhotoStacked]}
              contentFit="cover"
              transition={0}
            />
          ))}
        </View>
        <Text variant="micro">2 stops</Text>
        <Text variant="headline">Teekoy</Text>
        <Text variant="data">7 hrs out and back · about ₹250</Text>
      </View>
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
  pageSlot: { flex: 1 },
  page: { flex: 1, paddingHorizontal: GUTTER, justifyContent: 'center', gap: 34 },
  art: { height: 230, alignItems: 'center', justifyContent: 'center' },
  fanCard: {
    position: 'absolute',
    width: 124,
    height: 184,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: light.canvasTop,
    borderWidth: 3,
    borderColor: light.panel,
    boxShadow: shadows.card,
  },
  fanPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -9,
    marginTop: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: light.panel,
    backgroundColor: light.accent,
  },
  routeCard: {
    width: 250,
    padding: 18,
    borderRadius: 24,
    gap: 3,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.card,
  },
  routePhotos: { flexDirection: 'row', marginBottom: 12 },
  routePhoto: { width: 76, height: 84, borderRadius: 14, backgroundColor: light.canvasTop },
  routePhotoStacked: { marginLeft: -22, borderWidth: 2, borderColor: light.panel },
  nameInput: {
    marginTop: -12,
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
  districtPicker: { marginTop: -12, marginHorizontal: -GUTTER, paddingLeft: GUTTER },
  voteCard: {
    width: 290,
    padding: 14,
    gap: 12,
    borderRadius: 22,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.card,
  },
  voteHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voteThumb: { width: 48, height: 48, borderRadius: 13, backgroundColor: light.canvasTop },
  voteText: { flex: 1, gap: 1 },
  votePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: light.ink },
  votePillText: { fontFamily: fonts.sansSemi, fontSize: 12, lineHeight: 15, color: light.ctaInk },
  voteBar: { flexDirection: 'row', gap: 4, height: 6 },
  voteSlot: { flex: 1, borderRadius: 3 },
  voteChips: { flexDirection: 'row', gap: 8 },
  voteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 3,
    paddingRight: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: light.canvas,
  },
  voteEmoji: { fontSize: 14, lineHeight: 18 },
  voteNote: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    backgroundColor: light.canvas,
  },
  voteNoteName: { fontFamily: fonts.sansSemi, color: light.ink },
  copy: { gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 35, color: light.ink, letterSpacing: -1 },
  titleLead: { fontFamily: fonts.displayMedium, color: light.inkSoft, letterSpacing: -0.5 },
  body: { paddingRight: 8 },
  bottom: { paddingHorizontal: GUTTER, gap: 22 },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: 6, height: 6, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3, backgroundColor: light.ink },
});
