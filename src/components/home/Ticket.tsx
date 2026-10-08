import Feather from '@expo/vector-icons/Feather';
import { Image, type ImageProps } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { dims } from '@/components/pressed';
import { isLight } from '@/theme/mode';
import { light, shadows } from '@/theme/tokens';
import { Tone } from '@/theme/tone';

/** The stub's width: room for a 44pt tap and a two-digit count. */
const STUB = 64;
/** The corner where the two pieces meet. Two of them, back to back, are the notch at the tear. */
const NOTCH = 10;
const CORNER = 18;
// On the sky the ticket is pale paper; on the light look's pale canvas it has to be white to show.
const PAPER = isLight ? light.panel : light.canvas;

type Props = {
  photo: ImageProps['source'] | null;
  onPress: () => void;
  accessibilityLabel: string;
  /** What the ticket is for: a name and a line or two, in ink. */
  children: ReactNode;
  /** Past the tear line: a count, or the arrow that says it opens. */
  stub: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
};

/**
 * A paper ticket on the sky, for a trip to pick back up or one that's coming: a photo, what it's
 * for, and a stub past the tear line. Two pieces of paper set side by side, so the notches at the
 * tear are real gaps the sky shows through, whatever colour the sky is.
 */
export function Ticket({ photo, onPress, accessibilityLabel, children, stub, onDismiss, dismissLabel }: Props) {
  return (
    <Tone value="light">
      <View>
        <PressableScale onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
          <View style={styles.body}>
            {photo ? <Image source={photo} style={styles.photo} contentFit="cover" transition={0} /> : null}
            <View style={[styles.text, !!onDismiss && styles.textDismiss]}>{children}</View>
          </View>
          <View style={styles.stub}>
            <View style={styles.tear} pointerEvents="none">
              {Array.from({ length: 24 }, (_, i) => (
                <View key={i} style={styles.dash} />
              ))}
            </View>
            {stub}
          </View>
        </PressableScale>
        {onDismiss ? (
          <Pressable onPress={onDismiss} style={dims(styles.dismiss)} accessibilityRole="button" accessibilityLabel={dismissLabel}>
            <Feather name="x" size={14} color={light.inkSoft} />
          </Pressable>
        ) : null}
      </View>
    </Tone>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  body: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: PAPER,
    borderTopLeftRadius: CORNER,
    borderBottomLeftRadius: CORNER,
    borderTopRightRadius: NOTCH,
    borderBottomRightRadius: NOTCH,
    boxShadow: shadows.card,
  },
  photo: { width: 76, alignSelf: 'stretch', backgroundColor: light.line },
  text: { flex: 1, paddingVertical: 14, paddingHorizontal: 14, gap: 2, justifyContent: 'center' },
  // Keeps the words clear of the x in the corner.
  textDismiss: { paddingRight: 40 },
  stub: {
    width: STUB,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: PAPER,
    borderTopLeftRadius: NOTCH,
    borderBottomLeftRadius: NOTCH,
    borderTopRightRadius: CORNER,
    borderBottomRightRadius: CORNER,
    boxShadow: shadows.card,
  },
  // The tear line as short boxes, as on the share ticket: a dashed border draws differently on each platform.
  tear: { position: 'absolute', left: 0, top: NOTCH + 2, bottom: NOTCH + 2, width: 1.5, gap: 4, overflow: 'hidden' },
  dash: { width: 1.5, height: 5, backgroundColor: light.lineStrong },
  // Top-right of the body, out of the way of the ticket's own tap: 44pt, as every tap target.
  dismiss: { position: 'absolute', top: 0, right: STUB, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
