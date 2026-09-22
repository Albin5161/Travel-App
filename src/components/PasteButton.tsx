import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { useTone } from '@/theme/tone';
import { colors, light, shadows } from '@/theme/tokens';

type Props = {
  onText: (text: string) => void;
  /** `pill` shows "Paste"; `circle` is icon-only, for sitting beside a field. */
  shape?: 'pill' | 'circle';
  style?: StyleProp<ViewStyle>;
};

const PILL = { height: 36, width: 96 };
const CIRCLE = 48;

// On iOS 16+ this is Apple's UIPasteControl: the tap itself grants access, so iOS shows no
// "Allow Paste" alert, and it greys itself out when there's nothing to paste.
// Elsewhere it falls back to reading the clipboard on press.
export function PasteButton({ onText, shape = 'pill', style }: Props) {
  const tone = useTone();
  const bg = tone === 'light' ? light.cta : colors.mist;
  const fg = tone === 'light' ? light.ctaInk : colors.night;
  const circle = shape === 'circle';

  if (Clipboard.isPasteButtonAvailable) {
    return (
      <Clipboard.ClipboardPasteButton
        acceptedContentTypes={['url', 'plain-text']}
        displayMode={circle ? 'iconOnly' : 'iconAndLabel'}
        cornerStyle="capsule"
        backgroundColor={bg}
        foregroundColor={fg}
        onPress={(data) => {
          if (data.type === 'text') onText(data.text.trim());
        }}
        // UIPasteControl needs an explicit size or it renders nothing.
        style={[circle ? styles.circleSize : PILL, circle && styles.circleShadow, style]}
      />
    );
  }
  return (
    <PressableScale
      onPress={async () => {
        // The browser (web preview) can refuse clipboard access; then there's simply nothing to paste.
        const text = await Clipboard.getStringAsync().catch(() => '');
        onText(text.trim());
      }}
      style={[circle ? styles.circle : styles.pill, circle && styles.circleShadow, { backgroundColor: bg }, style]}
      accessibilityRole="button"
      accessibilityLabel="Paste"
    >
      {circle ? (
        <Feather name="clipboard" size={18} color={fg} />
      ) : (
        <Text variant="label" color={fg}>
          Paste
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    ...PILL,
    width: undefined,
    paddingHorizontal: 16,
    borderRadius: PILL.height / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSize: { width: CIRCLE, height: CIRCLE },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  circleShadow: { boxShadow: shadows.cta },
});
