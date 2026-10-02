import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';

const DIM = { opacity: 0.55 };

/**
 * Press feedback for a text link or a bare glyph, which has no surface to press in: it dims under
 * the finger, the way the system's own links do. Buttons and cards use PressableScale instead.
 */
export const dims =
  (style?: StyleProp<ViewStyle>) =>
  ({ pressed }: PressableStateCallbackType) => [style, pressed && DIM];
