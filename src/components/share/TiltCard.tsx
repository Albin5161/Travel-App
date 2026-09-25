import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useEffect, type ReactNode, type Ref } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { EASE_IN_OUT, EASE_OUT, SPRING_DRAG } from '@/lib/motion';

// A card you can tilt. On a phone it follows the gyroscope: the gravity vector, measured against a
// neutral that slowly drifts to however you're holding the phone, so it always settles flat. A finger
// can tilt it too, and where there's no sensor (web, the simulator) it sways gently until touched.
// Three layers sell the depth: the card rotates, a holographic foil band and a glare slide across it
// as if the light were fixed in the room, and its shadow shifts underneath.
//
// Everything runs on the UI thread; React never re-renders while it moves.

/** Tilt, normalised to −1…1 on each axis. x > 0: the right edge recedes. y > 0: the top edge recedes. */
export type Tilt = { x: SharedValue<number>; y: SharedValue<number> };

const TiltContext = createContext<Tilt | null>(null);

/** For layers inside the card that want parallax (the photo). */
export function useTilt() {
  const tilt = useContext(TiltContext);
  if (!tilt) throw new Error('useTilt must be used inside TiltCard');
  return tilt;
}

const MAX_DEG = 11;
// How strongly the phone's tilt maps onto the card: 15° of phone (≈0.26 g) gives about 0.7.
const SENSOR_GAIN = 3.2;
// Per reading (~60–120 Hz): how fast the neutral follows the phone (≈2 s to settle), and the
// low-pass that takes the tremor out of a hand.
const DRIFT = 0.012;
const SMOOTH = 0.18;
// Drag: points of finger travel for a full tilt.
const DRAG_RANGE = 150;
// The card leans with the phone, exaggerated: roll the right side away and its right edge recedes;
// tip the top away and its top recedes. (Gravity is in iOS's frame on both platforms: x to the right,
// y up the screen, about −1 g on y when held upright.) Flip a sign if an axis feels backwards.
const SENSOR_SIGN_X = 1;
const SENSOR_SIGN_Y = 1;

type Props = {
  width: number;
  height: number;
  radius?: number;
  /** Delay before the card is dealt in, so it lands after the headline. */
  delay?: number;
  /** The capturable face: everything that ends up in the shared image. Foil and glare stay out. */
  faceRef?: Ref<View>;
  children: ReactNode;
};

export function TiltCard({ width, height, radius = 28, delay = 0, faceRef, children }: Props) {
  const reduced = useReducedMotion();
  const gravity = useGravity();

  // Sensor: neutral, smoothed delta, and whether real readings have ever arrived.
  const base = useSharedValue<{ x: number; y: number } | null>(null);
  const sensorX = useSharedValue(0);
  const sensorY = useSharedValue(0);
  const live = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const sway = useSharedValue(0);
  const swayAmp = useSharedValue(0);

  const enter = useSharedValue(reduced ? 1 : 0);
  const deal = useSharedValue(reduced ? 0 : 22);
  const sweep = useSharedValue(0);

  useAnimatedReaction(
    () => (gravity ? gravity.get() : null),
    (g) => {
      if (!g || reduced) return;
      if (g.x === 0 && g.y === 0 && g.z === 0) return;
      const gx = (SENSOR_SIGN_X * g.x) / 9.81;
      const gy = (SENSOR_SIGN_Y * g.y) / 9.81;
      const b = base.get();
      if (!b) {
        base.set({ x: gx, y: gy });
        live.set(true);
        swayAmp.set(withTiming(0, { duration: 600 }));
        return;
      }
      const nb = { x: b.x + (gx - b.x) * DRIFT, y: b.y + (gy - b.y) * DRIFT };
      base.set(nb);
      sensorX.set(sensorX.get() + (gx - nb.x - sensorX.get()) * SMOOTH);
      sensorY.set(sensorY.get() + (gy - nb.y - sensorY.get()) * SMOOTH);
    },
  );

  useEffect(() => {
    if (reduced) return;
    enter.set(withDelay(delay, withTiming(1, { duration: 650, easing: EASE_OUT })));
    deal.set(withDelay(delay, withSpring(0, { duration: 900, dampingRatio: 0.62 })));
    // One pass of light across the card as it lands, to show it's something that catches light.
    sweep.set(withDelay(delay + 380, withTiming(1, { duration: 1100, easing: EASE_IN_OUT })));
    // No gyroscope yet: sway, so the foil is alive in the web preview and the simulator.
    // A real reading, or a finger, fades it out.
    sway.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
    swayAmp.set(withDelay(delay + 1400, withTiming(live.get() ? 0 : 1, { duration: 800 })));
    // Mount-only: the card is dealt once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = Gesture.Pan()
    .enabled(!reduced)
    .onBegin(() => {
      swayAmp.set(withTiming(0, { duration: 250 }));
    })
    .onUpdate((e) => {
      dragX.set(e.translationX / DRAG_RANGE);
      dragY.set(-e.translationY / DRAG_RANGE);
    })
    .onFinalize((e) => {
      dragX.set(withSpring(0, { ...SPRING_DRAG, velocity: e.velocityX / DRAG_RANGE }));
      dragY.set(withSpring(0, { ...SPRING_DRAG, velocity: -e.velocityY / DRAG_RANGE }));
    });

  const tx = useDerivedValue(() =>
    soft(Math.tanh(sensorX.get() * SENSOR_GAIN) + dragX.get() + swayAmp.get() * 0.45 * (sway.get() * 2 - 1)),
  );
  const ty = useDerivedValue(() =>
    soft(Math.tanh(sensorY.get() * SENSOR_GAIN) + dragY.get() + swayAmp.get() * 0.2 * (1 - sway.get() * 2)),
  );

  const body = useAnimatedStyle(() => {
    const e = enter.get();
    return {
      opacity: e,
      transform: [
        { perspective: 900 },
        { translateY: (1 - e) * 70 },
        { scale: 0.92 + 0.08 * e },
        { rotateX: `${deal.get() + ty.get() * MAX_DEG}deg` },
        { rotateY: `${tx.get() * MAX_DEG}deg` },
      ],
    };
  });

  // The shadow falls away from the edge that's lifted toward you.
  const shadow = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [
      { translateX: tx.get() * 14 },
      { translateY: 18 - ty.get() * 10 + (1 - enter.get()) * 70 },
      { scale: 0.9 },
    ],
  }));

  // Light is fixed in the room, so as the card turns the highlights travel the other way.
  const foil = useAnimatedStyle(() => {
    const x = tx.get();
    const y = ty.get();
    const s = sweep.get();
    const tilted = Math.min(1, Math.hypot(x, y) * 1.3);
    return {
      opacity: reduced ? 0.35 : 0.3 + 0.55 * tilted + 0.6 * Math.sin(Math.PI * s),
      transform: [{ translateX: -x * width * 0.9 + (s * 2 - 1) * width * 1.1 }, { translateY: y * height * 0.35 }],
    };
  });
  const glare = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * Math.min(1, Math.hypot(tx.get(), ty.get()) * 1.5),
    transform: [{ translateX: -tx.get() * width * 0.55 }, { translateY: ty.get() * height * 0.45 }],
  }));

  const tilt = { x: tx, y: ty };

  return (
    <TiltContext.Provider value={tilt}>
      <View style={{ width, height }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.shadow, { borderRadius: radius }, shadow]}
        />
        <GestureDetector gesture={pan}>
          <Animated.View style={[StyleSheet.absoluteFill, body]}>
            <View
              ref={faceRef}
              collapsable={false}
              style={[StyleSheet.absoluteFill, styles.face, { borderRadius: radius }]}
            >
              {children}
            </View>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
              <Animated.View style={[styles.glare, { width: width * 1.8, height: width * 1.8, left: -width * 0.4, top: -width * 0.55 }, glare]}>
                <Svg width="100%" height="100%">
                  <Defs>
                    <RadialGradient id="glare" cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.42} />
                      <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.1} />
                      <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Rect width="100%" height="100%" fill="url(#glare)" />
                </Svg>
              </Animated.View>
              <Animated.View
                style={[styles.foil, { width: width * 3, height: height * 1.6, left: -width, top: -height * 0.3 }, foil]}
              >
                <LinearGradient
                  colors={FOIL}
                  locations={FOIL_AT}
                  start={{ x: 0, y: 0.15 }}
                  end={{ x: 1, y: 0.85 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <View style={[StyleSheet.absoluteFill, styles.rim, { borderRadius: radius }]} />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </TiltContext.Provider>
  );
}

// A holographic band: pale rose, a white core, then ice blue and mint, all low alpha so the photo
// and the ink read straight through it.
const FOIL = [
  'rgba(255,255,255,0)',
  'rgba(255,196,222,0.16)',
  'rgba(255,236,196,0.22)',
  'rgba(255,255,255,0.5)',
  'rgba(186,228,255,0.26)',
  'rgba(200,255,226,0.16)',
  'rgba(255,255,255,0)',
] as const;
const FOIL_AT = [0.3, 0.38, 0.44, 0.5, 0.56, 0.62, 0.7] as const;

function soft(v: number) {
  'worklet';
  return Math.max(-1, Math.min(1, v));
}

// Gravity from the UI-thread sensor on a phone. The web has no sensor worth asking for (Reanimated
// would only log a warning), so there the card relies on drag and sway.
function useNativeGravity() {
  return useAnimatedSensor(SensorType.GRAVITY, { interval: 'auto' }).sensor;
}
function useNoGravity() {
  return null;
}
const useGravity = Platform.OS === 'web' ? useNoGravity : useNativeGravity;

const styles = StyleSheet.create({
  shadow: { backgroundColor: '#FFFFFF', boxShadow: '0 22px 40px rgba(17,17,17,0.22)' },
  face: { overflow: 'hidden', backgroundColor: '#FFFFFF' },
  clip: { overflow: 'hidden' },
  glare: { position: 'absolute' },
  foil: { position: 'absolute' },
  rim: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
});
