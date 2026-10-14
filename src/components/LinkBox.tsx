import Feather from '@expo/vector-icons/Feather';
import { useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { css, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import Ionicons from '@/components/Ionicons';
import { CIRCLE, PasteButton } from '@/components/PasteButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { detectPlatform } from '@/data/api';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { LINKS_AT_ONCE, linksIn } from '@/lib/links';
import { FADE_IN, FADE_OUT } from '@/lib/motion';
import { isLight } from '@/theme/mode';
import { skyCta, skyFill, skyInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { fonts, light, shadows } from '@/theme/tokens';

type Props = {
  onSubmit: (url: string) => void;
  /** Several links at once: they're read in the background instead of on a screen of their own. */
  onSubmitMany?: (urls: string[]) => void;
  /**
   * Say, with one link in the box, that more can go in with it. Off for someone who hasn't read a
   * video yet: their first time is one link and one arrow, nothing else to weigh. Several links
   * pasted together are still taken either way.
   */
  offerMore?: boolean;
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
const ALREADY = 'That video is already in.';

// The home screen's link field: type or paste a video link, or tap the system Paste button beside it.
// It takes several links too (pasted together, or one after another): those are read in the
// background, one by one.
export function LinkBox({ onSubmit, onSubmitMany, offerMore = true, clipboardHasLink }: Props) {
  // What's in the field: a link being typed, or the one link pasted.
  const [value, setValue] = useState('');
  // Links added beyond the first: each is a chip under the field, and the field is free for the
  // next. Run together in the field as one long line, a second link couldn't be seen to be there.
  const [added, setAdded] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The paste button couldn't read the clipboard: the field is focused and says how to paste by hand.
  const [unreadable, setUnreadable] = useState(false);
  const input = useRef<TextInput>(null);
  // Every video waiting to be read, each once, chips first.
  const links = linksIn([...added, value].join(' '));
  const typed = linksIn(value);
  const platform = typed.length ? detectPlatform(typed[0]) : null;
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

  const submit = () => {
    if (!value.trim() && !added.length) return;
    // A forwarded message ("Check this reel https://www.instagram.com/reel/…") carries words around
    // the link: only the links are read.
    if (links.length === 0) {
      reject();
      return;
    }
    Keyboard.dismiss();
    setValue('');
    setAdded([]);
    setError(null);
    setUnreadable(false);
    if (links.length > 1 && onSubmitMany) onSubmitMany(links.slice(0, LINKS_AT_ONCE));
    else onSubmit(links[0]);
  };

  // Pasting only fills the box. Nothing is read until Go: a wrong paste costs nothing, and the
  // person decides when to start.
  const fill = (text: string) => {
    const pasted = text.trim();
    if (!pasted) return;
    setUnreadable(false);
    const found = linksIn(pasted);
    if (!found.length) {
      if (!links.length) setValue(pasted);
      reject();
      return;
    }
    const all = linksIn([...links, ...found].join(' '));
    if (all.length === links.length) {
      // The same video again: nothing was added, and saying nothing looked like a paste that failed.
      setError(ALREADY);
      haptic.light();
      // A passing note, not a fault to clear: it goes by itself.
      setTimeout(() => setError((e) => (e === ALREADY ? null : e)), 2600);
      return;
    }
    setError(null);
    haptic.light();
    // One link sits in the field, as it always has. From the second on, each is a chip.
    if (all.length === 1 || !onSubmitMany) setValue(all[0]);
    else {
      setAdded(all);
      setValue('');
    }
  };

  const remove = (url: string) => {
    haptic.light();
    setError(null);
    const left = added.filter((l) => l !== url);
    // Back to one, with nothing being typed: it returns to the field, where one link lives.
    if (left.length === 1 && !value.trim()) {
      setValue(left[0]);
      setAdded([]);
    } else setAdded(left);
  };

  const pasteByHand = () => {
    haptic.light();
    setUnreadable(true);
    input.current?.focus();
    track('paste failed');
  };

  // Paste until there's a link, then Go: one button, always the next step. Over the sky it rides
  // inside the field's right end; on paper it sits beside it.
  const action = links.length ? (
    <Animated.View key="go" entering={FADE_IN}>
      <PressableScale
        onPress={submit}
        style={[styles.go, sky && styles.goSky]}
        accessibilityRole="button"
        accessibilityLabel={links.length > 1 ? `Go: find the places in these ${links.length} videos` : 'Go: find the places in this video'}
      >
        <Feather name="arrow-right" size={20} color={light.ctaInk} />
      </PressableScale>
    </Animated.View>
  ) : (
    <PasteButton shape="circle" onText={fill} onUnreadable={pasteByHand} />
  );

  const chips = added.slice(0, LINKS_AT_ONCE);
  const canAdd = !!onSubmitMany && links.length < LINKS_AT_ONCE;
  // One link in the box: the moment to say more can go in with it.
  const more = links.length === 1 && canAdd && offerMore && !error;
  const hint =
    error ??
    (more ? 'Another video to add?' : null) ??
    (unreadable && !value ? UNREADABLE : null) ??
    (clipboardHasLink && !value && !added.length ? 'You copied a link. Tap paste to add it.' : null);

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
            onSubmitEditing={submit}
            placeholder={added.length ? `${added.length} videos ready. Add another?` : 'Paste a video link'}
            placeholderTextColor={added.length ? ink.soft : ink.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectionColor={ink.strong}
            style={[styles.input, sky && styles.inputSky, { color: ink.strong }, NO_FOCUS_RING]}
            accessibilityLabel="Link to an Instagram reel or post, or a YouTube video"
          />
          {sky ? action : null}
        </Animated.View>
        {sky ? null : action}
      </View>
      <View style={styles.hintSlot}>
        {!chips.length ? null : (
          // One chip a video, so a second paste is seen to have landed, and any of them can go.
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
            {chips.map((url, i) => (
              <Animated.View key={url} entering={FADE_IN} style={[styles.chip, { backgroundColor: sky ? skyFill.raised : light.field, borderColor: sky ? skyInk.rim : light.line }]}>
                <Ionicons name={detectPlatform(url) === 'youtube' ? 'logo-youtube' : 'logo-instagram'} size={15} color={ink.strong} />
                <Text variant="label" color={ink.strong}>
                  Video {i + 1}
                </Text>
                <PressableScale onPress={() => remove(url)} hitSlop={10} style={styles.chipClose} accessibilityRole="button" accessibilityLabel={`Remove video ${i + 1}`}>
                  <Feather name="x" size={14} color={ink.soft} />
                </PressableScale>
              </Animated.View>
            ))}
            {canAdd ? (
              // Round and small here, so two videos and the way to add a third fit one line.
              <PasteButton shape="circle" size={40} quiet onText={fill} onUnreadable={pasteByHand} />
            ) : (
              <Text variant="label" color={ink.soft} style={styles.most}>
                {LINKS_AT_ONCE} at a time
              </Text>
            )}
          </ScrollView>
        )}
        {hint ? (
          <View style={styles.hintRow}>
            <Animated.View key={hint} entering={FADE_IN} exiting={FADE_OUT} style={styles.hint}>
              <Text variant="label" color={error ? ink.strong : ink.soft}>
                {hint}
              </Text>
            </Animated.View>
            {/* Outside the fade: Apple's paste button draws itself blank while anything over it is
                part-way see-through, and stayed blank after. */}
            {more ? <PasteButton shape="pill" quiet onText={fill} onUnreadable={pasteByHand} /> : null}
          </View>
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
    // In the light look the field is the page's own white inside a grey line, lifted by a faint
    // shadow: a grey slab on a white page read as a box of another colour set into it.
    backgroundColor: isLight ? light.panel : skyFill.raised,
    borderColor: skyInk.rim,
    boxShadow: isLight ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
  },
  fieldSkyFocused: { backgroundColor: isLight ? light.panel : skyFill.pressed, borderColor: skyInk.outline },
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
  goSky: { backgroundColor: skyCta, boxShadow: isLight ? 'none' : '0 6px 16px rgba(0,0,0,0.28)' },
  icon: { width: 20, alignItems: 'center', marginRight: 8 },
  // 16 or more: iPhone browsers zoom the whole page into a smaller text box and stay zoomed.
  input: { flex: 1, height: '100%', fontFamily: fonts.sans, fontSize: 16, color: light.ink },
  // The button rides inside the field here: a long link stops short of it instead of touching it.
  inputSky: { marginRight: 8 },
  // The row under the field (a hint, or the videos added): air above it, and the same air under it
  // before the card below. With nothing to say it is only that air, not an empty band.
  hintSlot: { paddingTop: 12, paddingBottom: 12, gap: 8 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  hint: { flex: 1, marginLeft: 4 },
  chips: { alignItems: 'center', gap: 8, paddingRight: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingLeft: 12, paddingRight: 8, borderRadius: 18, borderWidth: 1 },
  chipClose: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  most: { marginLeft: 4 },
});
