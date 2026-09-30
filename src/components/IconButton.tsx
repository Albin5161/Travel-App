import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { skyFill, skyInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { light, shadows } from '@/theme/tokens';

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

// Where the button sits: these go on its tap area. Everything else (size, colour) is the disc's.
const PLACEMENT = new Set(['position', 'top', 'right', 'bottom', 'left', 'zIndex', 'alignSelf', 'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'marginHorizontal', 'marginVertical']);

// Round white button for back, close and undo; sits on paper or on the map alike. Over the sky it
// is a disc of glass with a white glyph. Its tap area is the disc's own size: left to stretch, a
// button on a line of its own took the whole width of the screen.
export function IconButton({ icon, onPress, accessibilityLabel, style }: Props) {
  const sky = useTone() === 'sky';
  const flat = StyleSheet.flatten([styles.button, sky && styles.sky, style]) ?? {};
  const place: ViewStyle = {};
  const look: ViewStyle = {};
  for (const [k, v] of Object.entries(flat)) (PLACEMENT.has(k) ? place : look)[k as never] = v as never;
  return (
    <PressableScale
      onPress={onPress}
      containerStyle={[{ width: look.width, height: look.height }, place]}
      style={look}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Feather name={icon} size={icon === 'chevron-left' ? 22 : 18} color={sky ? skyInk.strong : light.ink} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.button,
  },
  sky: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: skyFill.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
    boxShadow: 'none',
  },
});
