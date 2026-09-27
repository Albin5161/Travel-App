import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { skyInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { light, shadows } from '@/theme/tokens';

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

// Round white button for back, close and undo; sits on paper or on the map alike. Over the sky it
// is a disc of glass with a white glyph.
export function IconButton({ icon, onPress, accessibilityLabel, style }: Props) {
  const sky = useTone() === 'sky';
  return (
    <PressableScale onPress={onPress} style={[styles.button, sky && styles.sky, style]} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
    boxShadow: 'none',
  },
});
