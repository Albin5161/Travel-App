import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/**
 * A sheet that rises over the screen as a pane of deep glass: the screen behind stays visible,
 * dimmed and blurred through it. Tap outside or swipe the system back to close. Everything on it
 * draws in the sky's white type.
 */
export function GlassSheet({ visible, onClose, maxHeight = '80%', children }: Props) {
  const insets = useSafeAreaInsets();
  const look = useScreenSky();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <Tone value="sky">
        <Glass
          tint={deepGlass(look, 0.8)}
          radius={radii.sheet}
          style={[styles.sheet, { maxHeight, paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.grabber} />
          {children}
        </Glass>
      </Tone>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,10,30,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.screen,
    paddingTop: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: skyInk.outline,
    marginBottom: 14,
  },
});
