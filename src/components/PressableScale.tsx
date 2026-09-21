import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { css, cubicBezier } from 'react-native-reanimated';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

// Feedback on press-in: 3% scale in 120ms. Commit happens on press-out via onPress.
export function PressableScale({ children, style, pressedScale = 0.97, disabled, ...rest }: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      hitSlop={rest.hitSlop ?? 8}
      pressRetentionOffset={16}
      onPressIn={(e) => {
        setPressed(true);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[styles.base, style, pressed && { transform: [{ scale: pressedScale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = css.create({
  base: {
    transform: [{ scale: 1 }],
    transitionProperty: 'transform',
    transitionDuration: '120ms',
    transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
  },
});
