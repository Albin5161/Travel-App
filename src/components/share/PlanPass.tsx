import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

import { Text } from '@/components/Text';
import { formatDay, formatRange, type TripPlan } from '@/data/planner';
import type { City } from '@/data/types';
import { formatClock } from '@/lib/geo';
import { Tone } from '@/theme/tone';
import { fonts, light } from '@/theme/tokens';

import { useTilt } from './TiltCard';

// The plan as a boarding pass: the city's photo above a perforated tear, then the trip as a ticket
// stub (when it starts and wraps up, the stops in order, an issue date and a barcode).
// Drawn inside TiltCard; the photo sits a little deeper than the card for parallax.

const MAX_ROWS = 4;
const PARALLAX = 9;
const NOTCH = 22;

type Props = { city: City; plan: TripPlan; width: number; height: number; issued: Date };

export function PlanPass({ city, plan, width, height, issued }: Props) {
  const tilt = useTilt();
  const photo = useAnimatedStyle(() => ({
    transform: [{ translateX: tilt.x.get() * PARALLAX }, { translateY: -tilt.y.get() * PARALLAX }],
  }));

  const n = plan.days.length;
  const stops = plan.days.flatMap((d, day) => d.stops.map((stop) => ({ stop, day })));
  const km = plan.days.reduce((sum, d) => sum + d.totalKm, 0);
  const first = stops[0]?.stop;
  const last = stops[stops.length - 1]?.stop;
  const firstDate = plan.days[0]?.date;
  const lastDate = plan.days[n - 1]?.date;
  // One day reads as clock times. Longer trips with dates read as dates; without, as clock times
  // across the whole trip.
  const byDate = n > 1 && firstDate && lastDate;
  const start = byDate ? formatDay(firstDate) : first ? formatClock(first.startMinutes) : '';
  const end = byDate ? formatDay(lastDate) : last ? formatClock(last.startMinutes + last.place.minutes) : '';
  const when = firstDate ? formatRange(firstDate, n) : n > 1 ? `${n} days` : null;
  const shown = stops.slice(0, MAX_ROWS);
  const more = stops.length - shown.length;
  // The stub is as tall as its rows; the photo takes whatever's left.
  const photoHeight = height - stubHeight(shown.length, more > 0);

  return (
    <View style={styles.fill}>
      <View style={[styles.photoWrap, { height: photoHeight }]}>
        <Animated.View style={[styles.photo, photo]}>
          <Image source={city.hero} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
        </Animated.View>
        <LinearGradient
          colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
          locations={[0, 0.3, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Tone value="dark">
          <View style={styles.photoTop}>
            <Text style={styles.brand}>Xplore</Text>
            <View style={styles.chip}>
              <Text variant="micro" color={light.photoInk} style={styles.chipText}>
                {n === 1 ? 'Day plan' : `${n}-day plan`}
              </Text>
            </View>
          </View>
          <View style={styles.photoBottom}>
            <Text variant="micro" color={light.photoInkSoft}>
              {when ? `${city.state} · ${when}` : city.state}
            </Text>
            <Text style={styles.city} numberOfLines={1} adjustsFontSizeToFit>
              {city.name}
            </Text>
          </View>
        </Tone>
      </View>

      <Perforation width={width} />

      <View style={styles.stub}>
        <View style={styles.times}>
          <View>
            <Text variant="micro">{byDate ? 'From' : 'Start'}</Text>
            <Text style={styles.time}>{start}</Text>
          </View>
          <View style={styles.track}>
            <View style={styles.trackLine} />
            {stops.map(({ stop }) => (
              <View key={stop.place.id} style={styles.trackDot} />
            ))}
          </View>
          <View style={styles.alignEnd}>
            <Text variant="micro">{byDate ? 'To' : 'Wrap up'}</Text>
            <Text style={styles.time}>{end}</Text>
          </View>
        </View>

        <View style={styles.rows}>
          {shown.map(({ stop: s, day }, i) => (
            <View key={s.place.id} style={styles.row}>
              <View style={styles.num}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <Text variant="label" numberOfLines={1} style={styles.rowName}>
                {s.place.name}
              </Text>
              <Text variant="data" style={styles.rowTime}>
                {n > 1 ? `Day ${day + 1} · ` : ''}
                {formatClock(s.startMinutes)}
              </Text>
            </View>
          ))}
          {more > 0 ? (
            <Text variant="data" color={light.inkFaint} style={styles.more}>
              + {more} more {more === 1 ? 'stop' : 'stops'}
            </Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <View>
            <Text variant="micro">Issued</Text>
            <Text variant="data" color={light.ink}>
              {issueDate(issued)} · {stops.length} stops · {km.toFixed(1)} km
            </Text>
          </View>
          <Barcode seed={`${city.id}${plan.seed}${stops.length}`} />
        </View>
      </View>
    </View>
  );
}

// The tear line, with a half-circle bitten out of each edge in the colour of the page behind.
function Perforation({ width }: { width: number }) {
  return (
    <View style={styles.perf}>
      <View style={[styles.notch, { left: -NOTCH / 2 }]} />
      <Svg width={width} height={2} style={styles.perfLine}>
        <Line x1={NOTCH} y1={1} x2={width - NOTCH} y2={1} stroke={light.lineStrong} strokeWidth={1.5} strokeDasharray="5 5" />
      </Svg>
      <View style={[styles.notch, { right: -NOTCH / 2 }]} />
    </View>
  );
}

// Decorative, but stable: the same plan always gets the same bars.
function Barcode({ seed }: { seed: string }) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < 84) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const w = 1 + ((h >>> 3) % 3);
    bars.push({ x, w });
    x += w + 1 + ((h >>> 7) % 3);
  }
  return (
    <View aria-hidden>
      <Svg width={86} height={28}>
        {bars.map((b) => (
          <Rect key={b.x} x={b.x} y={0} width={b.w} height={28} fill={light.ink} />
        ))}
      </Svg>
    </View>
  );
}

// Tear line, times, each stop row, the "+ n more" line and the footer.
function stubHeight(rows: number, more: boolean) {
  return NOTCH + 125 + rows * 25 + (more ? 25 : 0);
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function issueDate(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.panel },
  photoWrap: { overflow: 'hidden', backgroundColor: light.canvasTop },
  photo: { position: 'absolute', left: -PARALLAX - 2, right: -PARALLAX - 2, top: -PARALLAX - 2, bottom: -PARALLAX - 2 },
  photoTop: {
    position: 'absolute',
    left: 18,
    right: 16,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, letterSpacing: -0.7, color: light.photoInk },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: light.photoLine,
  },
  chipText: { fontSize: 10, lineHeight: 12, letterSpacing: 1.6 },
  photoBottom: { position: 'absolute', left: 18, right: 18, bottom: 14 },
  city: { fontFamily: fonts.display, fontSize: 38, lineHeight: 45, letterSpacing: -1.5, color: light.photoInk },
  perf: { height: NOTCH, justifyContent: 'center' },
  perfLine: { position: 'absolute', left: 0, top: NOTCH / 2 - 1 },
  notch: {
    position: 'absolute',
    top: 0,
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: light.canvas,
  },
  stub: { flex: 1, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 16 },
  times: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  time: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 24, letterSpacing: -0.4, color: light.ink, fontVariant: ['tabular-nums'] },
  alignEnd: { alignItems: 'flex-end' },
  track: { flex: 1, height: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: light.line,
  },
  trackDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: light.accent },
  rows: { marginTop: 14, gap: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: light.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontFamily: fonts.sansSemi, fontSize: 10, color: light.ctaInk, fontVariant: ['tabular-nums'] },
  rowName: { flex: 1 },
  rowTime: { fontSize: 12 },
  more: { marginLeft: 28, fontSize: 12 },
  footer: {
    marginTop: 'auto',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: light.lineStrong,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
});
