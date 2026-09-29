import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { skyAccent, skyCta, skyInk } from '@/theme/sky';

export const TICK = 26;

/**
 * The one tick on the sky: an empty ring until chosen (3:1 against any sky), then an ember disc
 * with a dark check. Used wherever something is ticked, so choosing looks the same everywhere.
 */
export function Tick({ on }: { on: boolean }) {
  return (
    <View style={[styles.ring, on && styles.on]}>
      {on ? <Feather name="check" size={14} color={skyCta} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: TICK,
    height: TICK,
    borderRadius: TICK / 2,
    borderWidth: 1.5,
    borderColor: skyInk.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: skyAccent, borderColor: skyAccent },
});
