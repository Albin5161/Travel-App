import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { useTone } from '@/theme/tone';
import { colors, light, shadows } from '@/theme/tokens';

type Props = {
  onText: (text: string) => void;
  /** The clipboard couldn't be read (refused, or empty): the caller offers the text field instead. */
  onUnreadable?: () => void;
  /** `pill` shows "Paste"; `circle` is icon-only, for sitting beside a field. */
  shape?: 'pill' | 'circle';
  style?: StyleProp<ViewStyle>;
};

const PILL = { height: 36, width: 96 };
export const CIRCLE = 48;

// On iOS 16+ this is Apple's UIPasteControl: the tap itself grants access, so iOS shows no
// "Allow Paste" alert, and it greys itself out when there's nothing to paste.
// Elsewhere it falls back to reading the clipboard on press.
export function PasteButton({ onText, onUnreadable, shape = 'pill', style }: Props) {
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
        // The browser can refuse (Safari's "Paste" bubble dismissed, or permission denied); then the
        // caller points at the text field, where a long-press paste always works.
        const text = (await readClipboard().catch(() => '')).trim();
        if (text) onText(text);
        else onUnreadable?.();
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

/**
 * On the web, one clipboard read, started inside the tap. Safari only allows it there, so a second
 * try after an await is refused. A link copied on an iPhone (Instagram's or YouTube's "Copy link")
 * can arrive as a URL with no plain text, which a plain-text read misses, so both are looked for.
 */
async function readClipboard(): Promise<string> {
  if (Platform.OS !== 'web') return Clipboard.getStringAsync();
  const clipboard = navigator.clipboard;
  if (!clipboard) return '';
  if (!clipboard.read) return clipboard.readText();
  for (const item of await clipboard.read()) {
    if (item.types.includes('text/plain')) {
      const text = await (await item.getType('text/plain')).text();
      if (text.trim()) return text;
    }
    if (item.types.includes('text/uri-list')) {
      // One URL per line; lines starting with # are comments.
      const list = await (await item.getType('text/uri-list')).text();
      const url = list.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#'));
      if (url) return url;
    }
  }
  return '';
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
