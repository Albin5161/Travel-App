import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, View, type DimensionValue } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { DURATION, EASE_OUT, EASE_SHEET, project, SPRING_DRAG } from '@/lib/motion';
import { deepGlass, skyInk } from '@/theme/sky';
import { Tone } from '@/theme/tone';
import { radii, space } from '@/theme/tokens';

import { Glass } from './Glass';
import { useScreenSky } from './SkyScreen';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** How tall the sheet may grow before its content scrolls. */
  maxHeight?: DimensionValue;
  children: ReactNode;
};

const RISE = { duration: DURATION.uiMax, easing: EASE_SHEET };
// Leaving is quicker than arriving: the person has already moved on.
const LEAVE = { duration: 200, easing: EASE_OUT };
/** How far the sheet gives when pulled up past its resting place. */
const GIVE = 60;

/**
 * A sheet that rises over the screen as a pane of deep glass: the screen behind stays visible,
 * dimmed and blurred through it. The dimming fades while the sheet slides, and the handle can be
 * pulled or flicked down to close. Tap outside or swipe the system back to close too. Everything on
 * it draws in the sky's white type.
 */
export function GlassSheet({ visible, onClose, maxHeight = '80%', children }: Props) {
  const insets = useSafeAreaInsets();
  const look = useScreenSky();
  const keyboard = useKeyboardHeight();
  const reduced = useReducedMotion();
  const tint = deepGlass(look, 0.8);

  // The sheet stays up until it has slid away, still showing what it showed when it was closed.
  const [was, setWas] = useState(visible);
  const [leaving, setLeaving] = useState(false);
  const [shown, setShown] = useState(children);
  if (visible !== was) {
    setWas(visible);
    setLeaving(!visible);
  }
  if (visible && shown !== children) setShown(children);

  const open = useSharedValue(0);
  const drag = useSharedValue(0);
  const height = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      drag.set(0);
      open.set(withTiming(1, reduced ? LEAVE : RISE));
    } else {
      open.set(
        withTiming(0, LEAVE, (finished) => {
          if (finished) scheduleOnRN(setLeaving, false);
        }),
      );
    }
  }, [drag, open, reduced, visible]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop({ top: 12, bottom: 8 })
        .onUpdate((e) => {
          // Pulled up, it gives less the further it goes, rather than stopping dead.
          drag.set(e.translationY > 0 ? e.translationY : e.translationY / (1 - e.translationY / GIVE));
        })
        .onEnd((e) => {
          // Where the pull would come to rest: a quick flick closes it as surely as a long drag.
          if (drag.get() + project(e.velocityY) > height.get() * 0.5) scheduleOnRN(onClose);
          else drag.set(withSpring(0, { ...SPRING_DRAG, velocity: e.velocityY }));
        }),
    [drag, height, onClose],
  );

  const dim = useAnimatedStyle(() => {
    const h = height.get();
    const pulled = h > 0 ? Math.min(1, Math.max(0, drag.get()) / h) : 0;
    return { opacity: open.get() * (1 - pulled) };
  });
  const rise = useAnimatedStyle(() => {
    const h = height.get();
    // Not measured yet: hold it hidden rather than flash it in place.
    if (h === 0) return { opacity: 0, transform: [{ translateY: 0 }] };
    // Reduce Motion: the sheet fades in where it rests. A pull still follows the finger.
    if (reduced) return { opacity: open.get(), transform: [{ translateY: drag.get() }] };
    return { opacity: 1, transform: [{ translateY: (1 - open.get()) * h + drag.get() }] };
  });

  return (
    <Modal visible={visible || leaving} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[styles.backdrop, dim]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <Tone value="sky">
          <Animated.View
            onLayout={(e) => height.set(e.nativeEvent.layout.height)}
            // With the keyboard up the sheet sits on top of it, so a field in it is never typed blind.
            style={[styles.dock, { maxHeight, bottom: keyboard }, rise]}
          >
            <Glass blur tint={tint} radius={radii.sheet} style={[styles.sheet, { paddingBottom: keyboard ? 12 : insets.bottom + 12 }]}>
              <GestureDetector gesture={pan}>
                <View style={styles.handle}>
                  <View style={styles.grabber} />
                </View>
              </GestureDetector>
              {visible ? children : shown}
            </Glass>
            {/* More of the same glass below the edge, so pulling the sheet up never opens a gap. */}
            <View style={[styles.below, { backgroundColor: tint }]} pointerEvents="none" />
          </Animated.View>
        </Tone>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** How much of the screen the keyboard covers, on a phone. A browser moves the page itself. */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,10,30,0.45)' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    flexShrink: 1,
    paddingHorizontal: space.screen,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  below: { position: 'absolute', left: 0, right: 0, top: '100%', height: GIVE },
  // The whole strip takes the pull, not only the 5pt bar drawn in it.
  handle: { alignItems: 'center', paddingTop: 10, paddingBottom: 14 },
  grabber: { width: 36, height: 5, borderRadius: 2.5, backgroundColor: skyInk.outline },
});
