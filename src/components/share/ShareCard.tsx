import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text as RNText, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { formatDay, formatRange, type TripPlan } from '@/data/planner';
import type { City } from '@/data/types';
import { useBlurredPhoto } from '@/lib/blur';
import { formatClock } from '@/lib/geo';
import { patternFor } from '@/lib/patterns';
import { QR_PATH, QR_QUIET, QR_SIZE } from '@/lib/qr';
import { skyAccent, type SkyLook } from '@/theme/sky';
import { fonts, light } from '@/theme/tokens';

import { PatternBackdrop } from './PatternBackdrop';
import { useOptionalTilt } from './TiltCard';

/** Feed-friendly 4:5, the tallest Instagram keeps whole in a post. */
export const CARD_RATIO = 1.25;
const MAX_ROWS = 3;
const PARALLAX = 9;
const INSET = 12;

type Props = {
  city: City;
  plan: TripPlan;
  width: number;
  issued: Date;
  /** Square corners for the saved post: a picture's corners outside a curve would come out white. */
  square?: boolean;
};

/**
 * The plan as a card worth posting: the city's photo full bleed, its name large across it, and the
 * plan on a pane of light frosted glass (the photo blurred behind white), in plain dark type. The
 * white pass people liked, now sitting on the picture.
 *
 * Built only from what a saved image keeps exactly (plain images, gradients, boxes and text): the
 * same card on screen and in the downloaded PNG.
 */
/**
 * What the card says, worked out once for both the card on screen and the picture drawn from it on
 * the web (src/lib/cardImage.ts). Sizes are in card units, a card 340 wide.
 */
export function cardFacts(city: City, plan: TripPlan, issued: Date) {
  const n = plan.days.length;
  const stops = plan.days.flatMap((d, day) => d.stops.map((stop) => ({ stop, day })));
  const km = plan.days.reduce((sum, d) => sum + d.totalKm, 0);
  const first = stops[0]?.stop;
  const last = stops[stops.length - 1]?.stop;
  const firstDate = plan.days[0]?.date;
  const lastDate = plan.days[n - 1]?.date;
  const byDate = !!(n > 1 && firstDate && lastDate);
  const start = byDate ? formatDay(firstDate!) : first ? formatClock(first.startMinutes) : '';
  const end = byDate ? formatDay(lastDate!) : last ? formatClock(last.startMinutes + last.place.minutes) : '';
  const when = firstDate ? formatRange(firstDate, n) : n > 1 ? `${n} days` : null;
  const shown = stops.slice(0, MAX_ROWS);
  const more = stops.length - shown.length;
  return {
    n,
    byDate,
    start,
    end,
    chip: n === 1 ? 'DAY PLAN' : `${n}-DAY PLAN`,
    kicker: (when ? `${city.state} · ${when}` : city.state).toUpperCase(),
    dots: Math.min(6, stops.length),
    rows: shown.map(({ stop, day }) => ({
      id: stop.place.id,
      name: clip(stop.place.name, n > 1 ? 22 : 30),
      time: `${n > 1 ? `Day ${day + 1} · ` : ''}${formatClock(stop.startMinutes)}`,
    })),
    more: more > 0 ? `+ ${more} more ${more === 1 ? 'stop' : 'stops'}` : null,
    issued: `ISSUED ${issueDate(issued)}`,
    facts: [`${stops.length} ${stops.length === 1 ? 'stop' : 'stops'}`, km >= 0.1 ? `${km.toFixed(1)} km` : null, 'xplore.expo.app']
      .filter(Boolean)
      .join(' · '),
    // The pane's height follows its rows, so the photo gets every point the plan doesn't need. The
    // foot is the QR's height, QR_UNITS.
    paneUnits: 18 + 44 + 14 + shown.length * 26 + (more > 0 ? 20 : 0) + 16 + 12 + QR_UNITS + 16,
  };
}

export const CARD_INSET = INSET;

export function ShareCard({ city, plan, width, issued, square }: Props) {
  const height = Math.round(width * CARD_RATIO);
  const s = width / 340;
  const facts = cardFacts(city, plan, issued);
  const { byDate, start, end } = facts;
  const paneH = Math.round(s * facts.paneUnits);
  const paneTop = height - INSET * s - paneH;
  const blurred = useBlurredPhoto(city.hero);

  return (
    <View style={[styles.card, { width, height, borderRadius: square ? 0 : 28 * s }]}>
      <Photo source={city.hero} width={width} height={height} />
      <LinearGradient
        colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
        locations={[0, 0.28, 0.4, 0.62]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.top, { left: 18 * s, right: 16 * s, top: 16 * s }]}>
        <RNText style={[styles.brand, { fontSize: 18 * s, lineHeight: 23 * s }]}>Xplore</RNText>
        <View style={[styles.chip, { paddingHorizontal: 10 * s, paddingVertical: 5 * s }]}>
          <RNText style={[styles.chipText, { fontSize: 10 * s, lineHeight: 12 * s, letterSpacing: 1.6 * s }]}>
            {facts.chip}
          </RNText>
        </View>
      </View>

      <View style={[styles.title, { left: 20 * s, right: 20 * s, bottom: height - paneTop + 14 * s }]}>
        <RNText style={[styles.kicker, { fontSize: 11 * s, lineHeight: 14 * s, letterSpacing: 1.8 * s }]} numberOfLines={1}>
          {facts.kicker}
        </RNText>
        <RNText style={[styles.city, { fontSize: 44 * s, lineHeight: 50 * s, letterSpacing: -1.6 * s }]} numberOfLines={1} adjustsFontSizeToFit>
          {city.name}
        </RNText>
      </View>

      {/* The pane: the photo behind it blurred, then white over that, then the plan in ink. */}
      <View
        style={[
          styles.pane,
          { left: INSET * s, right: INSET * s, top: paneTop, height: paneH, borderRadius: 22 * s },
        ]}
      >
        {blurred.source ? (
          <Image
            source={blurred.source}
            blurRadius={blurred.blurRadius}
            resizeMode="cover"
            style={{ position: 'absolute', left: -INSET * s, top: -paneTop, width, height }}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.frost]} />
        <LinearGradient colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']} locations={[0, 0.35]} style={StyleSheet.absoluteFill} />

        <View style={{ paddingHorizontal: 16 * s, paddingTop: 16 * s }}>
          <View style={styles.times}>
            <View>
              <RNText style={[styles.label, { fontSize: 10 * s, lineHeight: 13 * s, letterSpacing: 1.2 * s }]}>
                {byDate ? 'FROM' : 'START'}
              </RNText>
              <RNText style={[styles.time, { fontSize: 20 * s, lineHeight: 26 * s }]}>{start}</RNText>
            </View>
            <View style={[styles.track, { height: 26 * s }]}>
              <View style={[styles.trackLine, { top: 12 * s }]} />
              {Array.from({ length: facts.dots }, (_, i) => (
                <View key={i} style={[styles.dot, { width: 6 * s, height: 6 * s, borderRadius: 3 * s }]} />
              ))}
            </View>
            <View style={styles.end}>
              <RNText style={[styles.label, { fontSize: 10 * s, lineHeight: 13 * s, letterSpacing: 1.2 * s }]}>
                {byDate ? 'TO' : 'WRAP UP'}
              </RNText>
              <RNText style={[styles.time, { fontSize: 20 * s, lineHeight: 26 * s }]}>{end}</RNText>
            </View>
          </View>

          <View style={{ marginTop: 12 * s, gap: 6 * s }}>
            {facts.rows.map((row, i) => (
              <View key={row.id} style={[styles.row, { gap: 10 * s, height: 20 * s }]}>
                <View style={[styles.num, { width: 18 * s, height: 18 * s, borderRadius: 9 * s }]}>
                  <RNText style={[styles.numText, { fontSize: 10 * s, lineHeight: 13 * s }]}>{i + 1}</RNText>
                </View>
                <RNText style={[styles.rowName, { fontSize: 14 * s, lineHeight: 18 * s }]} numberOfLines={1}>
                  {row.name}
                </RNText>
                <RNText style={[styles.rowTime, { fontSize: 12 * s, lineHeight: 16 * s }]}>{row.time}</RNText>
              </View>
            ))}
            {facts.more ? (
              <RNText style={[styles.more, { fontSize: 12 * s, lineHeight: 16 * s, marginLeft: 28 * s }]}>{facts.more}</RNText>
            ) : null}
          </View>

          <Tear s={s} />
          <View style={styles.footer}>
            <View>
              <RNText style={[styles.label, { fontSize: 10 * s, lineHeight: 13 * s, letterSpacing: 1.2 * s }]}>
                {facts.issued}
              </RNText>
              <RNText style={[styles.facts, { fontSize: 12 * s, lineHeight: 16 * s }]}>
                {facts.facts}
              </RNText>
            </View>
            <QrTile s={s} />
          </View>
        </View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.paneRim, { borderRadius: 22 * s }]} />
      </View>
    </View>
  );
}

/** The photo, drifting a little against the tilt when on screen; still in a saved image. */
function Photo({ source, width, height }: { source: City['hero']; width: number; height: number }) {
  const tilt = useOptionalTilt();
  const drift = useAnimatedStyle(() =>
    tilt ? { transform: [{ translateX: -tilt.x.get() * PARALLAX }, { translateY: tilt.y.get() * PARALLAX }] } : {},
  );
  return (
    <Animated.View style={[styles.photo, drift]}>
      <Image source={source} resizeMode="cover" style={{ width: width + PARALLAX * 2 + 4, height: height + PARALLAX * 2 + 4 }} />
    </Animated.View>
  );
}

// The tear line as short boxes rather than a drawn dash: a saved image keeps boxes exactly.
function Tear({ s }: { s: number }) {
  return (
    <View style={[styles.tear, { marginTop: 14 * s, marginBottom: 12 * s, gap: 4 * s }]}>
      {Array.from({ length: 30 }, (_, i) => (
        <View key={i} style={[styles.tearDash, { width: 5 * s, height: 1.5 * s }]} />
      ))}
    </View>
  );
}

/** The QR tile's side, in card units: large enough for a phone to read it off a story. */
export const QR_UNITS = 40;

/**
 * Where the barcode was: a real QR code that opens xplore.expo.app, on a white tile so it reads on
 * any photo's frost. One path, so a picture of the card keeps it exactly.
 */
function QrTile({ s }: { s: number }) {
  const side = QR_UNITS * s;
  const span = QR_SIZE + QR_QUIET * 2;
  return (
    <View style={[styles.qr, { width: side, height: side, borderRadius: 6 * s }]} accessibilityLabel="QR code: opens xplore.expo.app">
      <Svg width={side} height={side} viewBox={`${-QR_QUIET} ${-QR_QUIET} ${span} ${span}`}>
        <Path d={QR_PATH} fill={light.ink} />
      </Svg>
    </View>
  );
}

/**
 * A long name, shortened by hand: a saved picture doesn't add the "…" a screen does, and would cut
 * the name off mid-letter.
 */
const clip = (name: string, max: number) => (name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name);

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function issueDate(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

/**
 * The same card as a 9:16 story: the sky behind, a line saying what it is, the card, and where
 * to make one. Laid out at 360 × 640 and saved at 1080 × 1920.
 */
export function ShareStory({ city, plan, issued, look }: { city: City; plan: TripPlan; issued: Date; look: SkyLook }) {
  const n = plan.days.length;
  const { pattern, credit } = patternFor(city.state);
  return (
    <View style={styles.story}>
      <LinearGradient colors={[...look.stops]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <PatternBackdrop pattern={pattern} top={look.stops[0]} />
      <View style={styles.storyHead}>
        <RNText style={styles.storyKicker}>{n === 1 ? 'MY NEXT DAY OUT' : 'MY NEXT TRIP'}</RNText>
        <RNText style={styles.storyTitle} numberOfLines={2}>
          {city.name}, <RNText style={styles.storyAccent}>sorted.</RNText>
        </RNText>
      </View>
      <View style={styles.storyCard}>
        <ShareCard city={city} plan={plan} width={280} issued={issued} />
      </View>
      <RNText style={styles.storyCredit}>{`BACKGROUND · ${credit.toUpperCase()}`}</RNText>
      <View style={styles.storyFoot}>
        <RNText style={styles.storyLine}>Turned from a travel reel, stop by stop.</RNText>
        <RNText style={styles.storyBrand}>Xplore · xplore.expo.app</RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: '#1B2A4E' },
  photo: { position: 'absolute', left: -PARALLAX - 2, top: -PARALLAX - 2 },
  top: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.display, color: '#FFFFFF', letterSpacing: -0.7 },
  chip: {
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  chipText: { fontFamily: fonts.sansSemi, color: '#FFFFFF' },
  title: { position: 'absolute', gap: 2 },
  kicker: { fontFamily: fonts.sansSemi, color: 'rgba(255,255,255,0.88)' },
  city: {
    fontFamily: fonts.display,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowRadius: 12,
  },
  pane: { position: 'absolute', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.28)' },
  // White over the blurred photo: light frosted glass, dark type reads at full contrast on it.
  frost: { backgroundColor: 'rgba(255,255,255,0.8)' },
  paneRim: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  times: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  label: { fontFamily: fonts.sansSemi, color: light.inkFaint },
  time: { fontFamily: fonts.displayBold, color: light.ink, letterSpacing: -0.4 },
  end: { alignItems: 'flex-end' },
  track: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackLine: { position: 'absolute', left: 0, right: 0, height: 2, borderRadius: 1, backgroundColor: 'rgba(17,17,17,0.12)' },
  dot: { backgroundColor: light.accent },
  row: { flexDirection: 'row', alignItems: 'center' },
  num: { backgroundColor: light.ink, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.sansSemi, color: '#FFFFFF' },
  rowName: { flex: 1, fontFamily: fonts.sansMedium, color: light.ink },
  rowTime: { fontFamily: fonts.sansMedium, color: light.inkSoft },
  more: { fontFamily: fonts.sansMedium, color: light.inkSoft },
  tear: { flexDirection: 'row', overflow: 'hidden' },
  tearDash: { borderRadius: 1, backgroundColor: 'rgba(17,17,17,0.22)' },
  // The facts sit level with the middle of the QR tile.
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  facts: { fontFamily: fonts.sansMedium, color: light.ink },
  qr: { backgroundColor: '#FFFFFF', overflow: 'hidden', flexShrink: 0 },
  story: { width: 360, height: 640, overflow: 'hidden', alignItems: 'center' },
  storyHead: { alignSelf: 'stretch', paddingHorizontal: 40, paddingTop: 52, gap: 8 },
  storyKicker: { fontFamily: fonts.sansSemi, fontSize: 11, lineHeight: 14, letterSpacing: 2, color: 'rgba(255,255,255,0.85)' },
  storyTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -1.1, color: '#FFFFFF' },
  storyAccent: { color: skyAccent },
  storyCard: { marginTop: 22, borderRadius: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.35)' },
  storyFoot: { position: 'absolute', left: 32, right: 32, bottom: 40, alignItems: 'center', gap: 6 },
  storyCredit: { marginTop: 16, fontFamily: fonts.sansSemi, fontSize: 10, lineHeight: 12, letterSpacing: 1.2, color: 'rgba(255,255,255,0.72)' },
  storyLine: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.88)', textAlign: 'center' },
  storyBrand: { fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 21, color: '#FFFFFF' },
});
