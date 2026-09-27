import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/Text';
import { formatDay, fromIso, type TripPlan } from '@/data/planner';
import { smoothPath, type Point } from '@/lib/geo';
import { skyAccent, skyAccentText, skyFill, skyInk } from '@/theme/sky';
import { colors, fonts, light } from '@/theme/tokens';

// The pieces that make a trip card read as a journey rather than a list: the shape of the route,
// the days as photos, and where you are in it.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where the trip stands today, from its dates: "In 12 days", "Tomorrow", "Day 2 of 3", "Done".
 * `today` is the day it's on, when it's on.
 */
export function tripWhen(plan: TripPlan, now = new Date()): { label: string; today?: number; past?: boolean } {
  const start = plan.days[0]?.date;
  if (!start) return { label: 'Dates to come' };
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const until = Math.round((fromIso(start).getTime() - midnight.getTime()) / DAY_MS);
  const n = plan.days.length;
  if (until > 1) return { label: `In ${until} days` };
  if (until === 1) return { label: 'Tomorrow' };
  if (-until < n) return { label: n === 1 ? 'Today' : `Day ${1 - until} of ${n}`, today: -until };
  return { label: 'Done', past: true };
}

/**
 * The trip's route as a line, the way a run's card shows its shape: every stop in order, all days,
 * drawn from where the places really are. The first stop is ember, so the line has a start.
 */
export function RouteShape({ plan, width = 76, height = 52 }: { plan: TripPlan; width?: number; height?: number }) {
  const coords = plan.days.flatMap((d) => d.stops.map((s) => s.place.coords));
  if (coords.length < 2) return null;
  // Flat projection: a degree of longitude is shorter the further from the equator.
  const k = Math.cos((coords.reduce((n, c) => n + c.lat, 0) / coords.length) * (Math.PI / 180));
  const raw = coords.map((c): Point => [c.lng * k, -c.lat]);
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const pad = 5;
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const s = Math.min((width - pad * 2) / (spanX || 1), (height - pad * 2) / (spanY || 1));
  // Centred in the box, whichever way the route runs.
  const ox = (width - spanX * s) / 2 - Math.min(...xs) * s;
  const oy = (height - spanY * s) / 2 - Math.min(...ys) * s;
  const pts = raw.map(([x, y]): Point => [x * s + ox, y * s + oy]);

  const d = smoothPath(pts);
  return (
    <View aria-hidden>
    <Svg width={width} height={height}>
      {/* A soft dark edge under the white line, so it holds on the brightest photo. */}
      <Path d={d} stroke={SHADE} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke={light.photoInk} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {pts.map(([x, y], i) => (
        <Circle
          key={i}
          cx={x}
          cy={y}
          r={i === 0 ? 3.5 : 2.5}
          fill={i === 0 ? colors.ember : light.photoInk}
          stroke={i === 0 ? light.photoInk : 'none'}
          strokeWidth={1.5}
        />
      ))}
    </Svg>
    </View>
  );
}

const SHADE = 'rgba(0,0,0,0.3)';

// Enough of a day to recognise it; the rest is a count. A short trip has room for more of each day.
const PER_DAY = [6, 4, 3, 3];
// Days beyond these fold into "+N days", so the strip fits a phone without scrolling.
const MAX_DAYS_SHOWN = 4;
const THUMB = 34;

/** The trip day by day: each day's first photos in a cluster, joined by the road between them. */
export function DayStrip({ plan, today }: { plan: TripPlan; today?: number }) {
  const days = plan.days.slice(0, MAX_DAYS_SHOWN);
  const more = plan.days.length - days.length;
  return (
    <View style={styles.strip}>
      {days.map((day, d) => {
        const shown = day.stops.slice(0, PER_DAY[days.length - 1]);
        const extra = day.stops.length - shown.length;
        const on = today === d;
        return (
          <View key={d} style={styles.dayWrap}>
            {d > 0 ? <View style={styles.road} /> : null}
            <View style={styles.day}>
              <View style={styles.cluster}>
                {shown.length === 0 ? (
                  <View style={[styles.thumb, styles.emptyThumb]} />
                ) : (
                  shown.map((s, i) => (
                    <Image
                      key={s.place.id}
                      source={s.place.photo}
                      style={[styles.thumb, i > 0 && styles.overlap, on && styles.thumbToday]}
                      contentFit="cover"
                      transition={0}
                    />
                  ))
                )}
                {extra > 0 ? (
                  <View style={[styles.thumb, styles.overlap, styles.moreThumb]}>
                    <Text style={styles.moreText}>+{extra}</Text>
                  </View>
                ) : null}
              </View>
              {/* The date, where there is one; today's in ember, matching the chip on the photo. */}
              <Text variant="micro" color={on ? skyAccentText : skyInk.faint}>
                {day.date ? formatDay(day.date).replace(/ \w+$/, '') : `Day ${d + 1}`}
              </Text>
            </View>
          </View>
        );
      })}
      {more > 0 ? (
        <View style={styles.dayWrap}>
          <View style={styles.road} />
          <Text variant="micro" style={styles.moreDays}>
            +{more} {more === 1 ? 'day' : 'days'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'flex-start' },
  dayWrap: { flexDirection: 'row', alignItems: 'flex-start' },
  day: { alignItems: 'flex-start', gap: 6 },
  cluster: { flexDirection: 'row' },
  // A dotted road from one day's cluster to the next, at the photos' middle.
  road: {
    width: 14,
    marginTop: THUMB / 2,
    marginHorizontal: 5,
    borderTopWidth: 1.5,
    borderStyle: 'dotted',
    borderColor: skyInk.outline,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    borderColor: skyInk.rim,
    backgroundColor: skyFill.pane,
  },
  thumbToday: { borderColor: skyAccent },
  overlap: { marginLeft: -10 },
  emptyThumb: { borderStyle: 'dashed', borderColor: skyInk.outline, backgroundColor: 'transparent' },
  moreThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: skyFill.pressed },
  moreText: { fontFamily: fonts.sansSemi, fontSize: 11, lineHeight: 14, color: skyInk.strong, fontVariant: ['tabular-nums'] },
  moreDays: { marginTop: THUMB / 2 - 8 },
});
