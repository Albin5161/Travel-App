import Feather from '@expo/vector-icons/Feather';
import { useRef, useState } from 'react';
import { Keyboard, Platform, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { css, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import Ionicons from '@/components/Ionicons';
import { CIRCLE, PasteButton } from '@/components/PasteButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { detectPlatform } from '@/data/api';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { FADE_IN, FADE_OUT } from '@/lib/motion';
import { skyCta, skyFill, skyInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { fonts, light, shadows } from '@/theme/tokens';

type Props = {
  onSubmit: (url: string) => void;
  /** A link is on the clipboard (checked without reading it, so no iOS alert). */
  clipboardHasLink?: boolean;
};

const HEIGHT = 48;
/** Over the sky the field is taller, to hold the paste button inside it. */
const SKY_HEIGHT = 58;
const GAP = 10;
/** Width the paste button and its gap take from the row: the field is the rest. */
export const FIELD_TRAILING = CIRCLE + GAP;
// Says what a good link looks like, since "not a link" alone leaves you guessing.
const ERROR = 'That’s not an Instagram or YouTube link. They look like instagram.com/reel/… or youtu.be/…';
const UNREADABLE = 'Tap and hold the box, then Paste.';
/** The first Instagram or YouTube link in a piece of text, with or without https:// and www. */
const LINK_IN_TEXT = /(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am|youtube\.com|youtu\.be)\/[^\s<>"]+/i;

// The home screen's link field: type or paste a video link, or tap the system Paste button beside it.
export function LinkBox({ onSubmit, clipboardHasLink }: Props) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The paste button couldn't read the clipboard: the field is focused and says how to paste by hand.
  const [unreadable, setUnreadable] = useState(false);
  const input = useRef<TextInput>(null);
  const platform = detectPlatform(value);
  const sky = useTone() === 'sky';
  const ink = sky ? SKY_INK : PAPER_INK;

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  const reject = () => {
    setError(ERROR);
    haptic.error();
    shake.set(
      withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 60 }),
        withTiming(-5, { duration: 60 }),
        withTiming(5, { duration: 60 }),
        withTiming(0, { duration: 70 }),
      ),
    );
  };

  const submit = (text: string) => {
    const raw = text.trim();
    if (!raw) return;
    // A forwarded message ("Check this reel https://www.instagram.com/reel/…") carries words around
    // the link: only the link is read.
    const url = raw.match(LINK_IN_TEXT)?.[0] ?? raw;
    if (!detectPlatform(url)) {
      setValue(raw);
      reject();
      return;
    }
    Keyboard.dismiss();
    setValue('');
    setError(null);
    setUnreadable(false);
    onSubmit(url);
  };

  // Pasting only fills the box. Nothing is read until Go: a wrong paste costs nothing, and the
  // person decides when to start.
  const fill = (text: string) => {
    const url = text.trim();
    if (!url) return;
    setValue(url);
    setUnreadable(false);
    if (detectPlatform(url)) {
      setError(null);
      haptic.light();
    } else reject();
  };

  const pasteByHand = () => {
    haptic.light();
    setUnreadable(true);
    input.current?.focus();
    track('paste failed');
  };

  // Paste until there's a link in the box, then Go: one button, always the next step. Over the sky
  // it rides inside the field's right end; on paper it sits beside it.
  const action = platform ? (
    <Animated.View key="go" entering={FADE_IN}>
      <PressableScale
        onPress={() => submit(value)}
        style={[styles.go, sky && styles.goSky]}
        accessibilityRole="button"
        accessibilityLabel="Go: find the places in this video"
      >
        <Feather name="arrow-right" size={20} color={light.ctaInk} />
      </PressableScale>
    </Animated.View>
  ) : (
    <PasteButton shape="circle" onText={fill} onUnreadable={pasteByHand} />
  );

  const hint = error ?? (unreadable && !value ? UNREADABLE : null) ?? (clipboardHasLink && !value ? 'You copied a link. Tap paste to add it.' : null);

  return (
    <View>
      <View style={styles.row}>
        <Animated.View
          style={[styles.field, focused && styles.fieldFocused, sky && styles.fieldSky, sky && WEB_FROST, sky && focused && styles.fieldSkyFocused, shakeStyle]}
        >
          <View style={styles.icon}>
            {platform ? (
              <Animated.View key={platform} entering={FADE_IN}>
                <Ionicons
                  name={platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'}
                  size={18}
                  color={ink.strong}
                />
              </Animated.View>
            ) : (
              <Feather name="link" size={16} color={ink.faint} />
            )}
          </View>
          <TextInput
            ref={input}
            value={value}
            onChangeText={(t) => {
              setValue(t);
              setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => submit(value)}
            placeholder="Paste a video link"
            placeholderTextColor={ink.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectionColor={ink.strong}
            style={[styles.input, { color: ink.strong }, NO_FOCUS_RING]}
            accessibilityLabel="Link to an Instagram reel or post, or a YouTube video"
          />
          {sky ? action : null}
        </Animated.View>
        {sky ? null : action}
      </View>
      <View style={styles.hintSlot}>
        {hint ? (
          <Animated.View key={hint} entering={FADE_IN} exiting={FADE_OUT}>
            <Text variant="label" color={error ? ink.strong : ink.soft} style={styles.hint}>
              {hint}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const PAPER_INK = { strong: light.ink, soft: light.inkSoft, faint: light.inkFaint };
const SKY_INK = { strong: skyInk.strong, soft: skyInk.soft, faint: skyInk.faint };

// Over the sky the field is frosted glass: the photo prints tucked behind it blur through rather
// than showing sharp. Phones get the same from the field's own translucency.
const WEB_FROST =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(18px) saturate(140%)', WebkitBackdropFilter: 'blur(18px) saturate(140%)' } as ViewStyle)
    : null;

// Web only: the browser draws its own focus ring round the inner input, in the system accent colour
// and narrower than the pill. outlineWidth: 0 isn't enough, since Chrome's 'auto' ring ignores width.
// The pill's darker border is the focus state. RN's types don't list 'none', hence the cast.
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = css.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  field: {
    flex: 1,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    backgroundColor: light.field,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.field,
    transitionProperty: 'borderColor',
    transitionDuration: '180ms',
  },
  fieldFocused: { borderColor: light.lineStrong },
  // Over the sky: frosted white, a lighter pane of the same glass as the cards around it.
  fieldSky: {
    height: SKY_HEIGHT,
    borderRadius: SKY_HEIGHT / 2,
    paddingRight: (SKY_HEIGHT - CIRCLE) / 2,
    backgroundColor: skyFill.raised,
    borderColor: skyInk.rim,
    boxShadow: 'none',
  },
  fieldSkyFocused: { backgroundColor: skyFill.pressed, borderColor: skyInk.outline },
  // The paste button's twin, so the swap reads as the same button changing job.
  go: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.cta,
    boxShadow: shadows.cta,
  },
  goSky: { backgroundColor: skyCta, boxShadow: '0 6px 16px rgba(0,0,0,0.28)' },
  icon: { width: 20, alignItems: 'center', marginRight: 10 },
  // 16 or more: iPhone browsers zoom the whole page into a smaller text box and stay zoomed.
  input: { flex: 1, height: '100%', fontFamily: fonts.sans, fontSize: 16, color: light.ink },
  // Room for one hint line, so one appearing never moves the page.
  hintSlot: { minHeight: 34, justifyContent: 'center' },
  hint: { marginTop: 8, marginLeft: 4 },
});
