import { createContext, useContext, type ReactNode } from 'react';
import { type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

// Content that reveals itself as it scrolls into view, driven by the scroll position itself rather
// than by timers: each piece fades up over the first stretch of its way onto the screen, and runs
// back the other way if you scroll back. What's on screen when the page opens is simply there.

/** How far into the view (in points) a piece travels while it reveals. */
const DISTANCE = 140;
/** Where along the bottom of the view the reveal starts: a little above the edge, so it's seen. */
const LEAD = 24;
const RISE = 28;

type Frame = {
  scrollY: SharedValue<number>;
  viewH: SharedValue<number>;
  contentH: SharedValue<number>;
  base: SharedValue<number>;
};
const RevealContext = createContext<Frame | null>(null);

/**
 * The scroll view's side: an Animated.ScrollView's props (onScroll, onLayout) that feed the pieces,
 * and the provider to wrap its content in.
 */
export function useReveal() {
  const scrollY = useSharedValue(0);
  const viewH = useSharedValue(0);
  const contentH = useSharedValue(0);
  const base = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const onLayout = (e: LayoutChangeEvent) => viewH.set(e.nativeEvent.layout.height);
  const onContentSizeChange = (_w: number, h: number) => contentH.set(h);
  const frame: Frame = { scrollY, viewH, contentH, base };
  return { onScroll, onLayout, onContentSizeChange, scrollEventThrottle: 16, frame };
}

export function RevealProvider({ frame, children }: { frame: Frame; children: ReactNode }) {
  return <RevealContext.Provider value={frame}>{children}</RevealContext.Provider>;
}

/**
 * A piece that reveals on scroll. Inside a Reveal `group` (a card), its children measure from the
 * card's top, so each row inside the card still reveals on its own.
 */
export function Reveal({
  children,
  style,
  group,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Children reveal one by one inside this, instead of this revealing as a whole. */
  group?: boolean;
}) {
  const frame = useContext(RevealContext);
  const reduced = useReducedMotion();
  const y = useSharedValue(-1);
  const ownBase = useSharedValue(0);

  const animated = useAnimatedStyle(() => {
    if (!frame || reduced || group) return {};
    const top = frame.base.get() + y.get();
    // Not measured yet: hold it hidden rather than flash it in.
    if (y.get() < 0 || frame.viewH.get() === 0) return { opacity: 0 };
    const entered = frame.scrollY.get() + frame.viewH.get() - LEAD - top;
    // Near the end there may not be a full DISTANCE left to scroll: the reveal then completes by
    // the bottom, so the last piece is never left half faded.
    const room = frame.contentH.get() > 0 ? frame.contentH.get() - LEAD - top : DISTANCE;
    const span = Math.max(1, Math.min(DISTANCE, room));
    const p = interpolate(entered, [0, span], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * RISE }, { scale: 0.97 + 0.03 * p }] };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    y.set(e.nativeEvent.layout.y);
    if (group && frame) ownBase.set(frame.base.get() + e.nativeEvent.layout.y);
  };

  const content =
    group && frame ? (
      <RevealContext.Provider value={{ scrollY: frame.scrollY, viewH: frame.viewH, contentH: frame.contentH, base: ownBase }}>
        {children}
      </RevealContext.Provider>
    ) : (
      children
    );
  return (
    <Animated.View onLayout={onLayout} style={[style, animated]}>
      {content}
    </Animated.View>
  );
}
