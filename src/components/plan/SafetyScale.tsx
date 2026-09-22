import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { SAFETY_BAND_STARTS, SAFETY_BANDS, safetyBand, type SafetySignal } from '@/data/cityInfo';
import { fonts, light } from '@/theme/tokens';

const UP = '#1F7A4D';
const DOWN = '#9B2C2C';
const FILL = 900;
const EASE = Easing.bezier(0.23, 1, 0.32, 1);

type Props = {
  cityName: string;
  score: number;
  signals: SafetySignal[];
  /** Fill the bar the first time the section is on screen. */
  play: boolean;
};

// After Atlys's "India currently": the score sits above the end of a gradient fill, with the bands
// under the bar (the ones reached in ink, the rest faint), then the dated signals behind the score.
export function SafetyScale({ cityName, score, signals, play }: Props) {
  const reduced = useReducedMotion();
  const [trackW, setTrackW] = useState(0);
  const p = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (play && !reduced) p.set(withTiming(1, { duration: FILL, easing: EASE }));
  }, [p, play, reduced]);

  const fill = useAnimatedStyle(() => ({ width: (trackW * score * p.get()) / 100 }));
  const number = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ translateX: Math.max(0, (trackW * score * p.get()) / 100 - 22) }],
  }));

  const band = safetyBand(score);
  const reached = SAFETY_BANDS.indexOf(band);

  return (
    <View accessible accessibilityLabel={`${cityName} safety, ${score} out of 100, ${band}`}>
      <Text variant="bodyStrong">{cityName} currently</Text>

      <View style={styles.numberRow}>
        <Animated.Text style={[styles.number, number]}>{score}</Animated.Text>
      </View>

      <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.fill, fill]}>
          {/* The gradient spans the whole track, so the colour at the fill's end matches the score. */}
          <LinearGradient
            colors={['#E8A98C', '#B7A26A', '#6E9A6A', UP]}
            locations={[0, 0.35, 0.65, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: trackW, height: '100%' }}
          />
        </Animated.View>
      </View>

      <View style={styles.bands}>
        {SAFETY_BANDS.map((b, i) => (
          <Text
            key={b}
            variant="label"
            color={i <= reached ? light.ink : light.inkFaint}
            // The last band is right-aligned so it ends with the track.
            style={[styles.band, i === SAFETY_BANDS.length - 1 ? styles.last : { left: `${SAFETY_BAND_STARTS[i]}%` }]}
          >
            {b}
          </Text>
        ))}
      </View>

      <View style={styles.timeline}>
        {signals.map((s, i) => (
          <View key={`${s.month}${s.year}`} style={styles.signal}>
            <View style={styles.when}>
              <Text style={styles.month}>{s.month}</Text>
              <Text variant="data">{s.year}</Text>
              {i < signals.length - 1 ? <View style={styles.rail} /> : null}
            </View>
            <View style={styles.card}>
              <Text variant="body" color={light.ink}>
                {s.text}
              </Text>
              <Text variant="label" color={s.direction === 'up' ? UP : DOWN} style={styles.tag}>
                {s.direction === 'up' ? '▲' : '▼'} {s.tag}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text variant="data" color={light.inkFaint} style={styles.basis}>
        Based on traveller reports and local news. Sample data for the demo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  numberRow: { height: 44, marginTop: 6, justifyContent: 'flex-end' },
  number: { fontFamily: fonts.sansSemi, fontSize: 34, lineHeight: 40, color: UP, fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 5, backgroundColor: light.canvasTop, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 5, overflow: 'hidden' },
  bands: { height: 20, marginTop: 10 },
  band: { position: 'absolute', top: 0 },
  last: { right: 0 },
  timeline: { marginTop: 24, gap: 12 },
  signal: { flexDirection: 'row', gap: 14 },
  when: { width: 44, alignItems: 'center', paddingTop: 14 },
  month: { fontFamily: fonts.sansSemi, fontSize: 17, lineHeight: 22, color: light.ink },
  rail: {
    flex: 1,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: light.lineStrong,
    marginTop: 10,
    marginBottom: -8,
  },
  card: { flex: 1, padding: 16, borderRadius: 18, backgroundColor: light.canvas, gap: 10 },
  tag: { alignSelf: 'flex-end' },
  basis: { marginTop: 14 },
});
