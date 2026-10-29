import { Icon } from '@/components/Icon';
import { useRef, useState } from 'react';
import { Keyboard, Platform, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { css, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { ErrorNote } from '@/components/ErrorNote';
import Ionicons from '@/components/Ionicons';
import { CIRCLE, PasteButton } from '@/components/PasteButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { detectPlatform } from '@/data/api';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { LINKS_AT_ONCE, linkKey, linksIn } from '@/lib/links';
import { FADE_IN, FADE_OUT } from '@/lib/motion';
import { isLight } from '@/theme/mode';
import { skyCta, skyDanger, skyFill, skyInk } from '@/theme/sky';
import { useTone } from '@/theme/tone';
import { fonts, fontSize, light, radii, shadows } from '@/theme/tokens';

type Props = {
  onSubmit: (url: string) => void;
  /** Several links at once: they're read in the background instead of on a screen of their own. */
  onSubmitMany?: (urls: string[]) => void;
  /**
   * Offer "Add another video" once a link is in. Off for someone who hasn't read a video yet: their
   * first time is one link and one arrow, nothing else to weigh. Several links pasted together
   * still fill a field each either way.
   */
  offerMore?: boolean;
  /** A link is on the clipboard (checked without reading it, so no iOS alert). */
  clipboardHasLink?: boolean;
};

const HEIGHT = 48;
/** Over the sky the field is taller, to hold the paste button inside it. */
const SKY_HEIGHT = 58;
const GAP = 10;
/** The Paste button inside an empty extra field: smaller, so the field keeps its height. */
const SMALL_CIRCLE = 36;
/** Width the paste button and its gap take from the row: the field is the rest. */
export const FIELD_TRAILING = CIRCLE + GAP;
// Says what a good link looks like, since "not a link" alone leaves you guessing.
const ERROR = 'That’s not an Instagram or YouTube link. They look like instagram.com/reel/… or youtu.be/…';
const UNREADABLE = 'Tap and hold the box, then Paste.';
const ALREADY = 'That video is already in.';

// The home screen's link field: type or paste a video link, or tap the system Paste button beside it.
// Up to three at once: with one link in, "Add another video" opens a field under it for the next,
// and one button reads them all. On phones the Paste pill that used to offer this drew blank, and
// the hint above it looked like a button that did nothing.
export function LinkBox({ onSubmit, onSubmitMany, offerMore = true, clipboardHasLink }: Props) {
  // One entry a field: a link being typed, or one pasted. The first is the field that was always here.
  const [values, setValues] = useState<string[]>(['']);
  const [focused, setFocused] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The paste button couldn't read the clipboard: the field is focused and says how to paste by hand.
  const [unreadable, setUnreadable] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
  // A field just opened takes the keyboard as soon as it's drawn.
  const focusAt = useRef<number | null>(null);
  // Every video waiting to be read, each once, in field order.
  const links = linksIn(values.join(' '));
  const many = values.length > 1;
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
    if (!values.some((v) => v.trim())) return;
    // A forwarded message ("Check this reel https://www.instagram.com/reel/…") carries words around
    // the link: only the links are read.
    if (links.length === 0) {
      reject();
      return;
    }
    Keyboard.dismiss();
    setValues(['']);
    setError(null);
    setUnreadable(false);
    if (links.length > 1 && onSubmitMany) onSubmitMany(links.slice(0, LINKS_AT_ONCE));
    else onSubmit(links[0]);
  };

  // Pasting only fills the box. Nothing is read until Go: a wrong paste costs nothing, and the
  // person decides when to start. Several links pasted together fill a field each, up to three.
  const fill = (at: number) => (text: string) => {
    const pasted = text.trim();
    if (!pasted) return;
    setUnreadable(false);
    const found = linksIn(pasted);
    if (!found.length) {
      if (!values[at]) setValues((vs) => vs.map((v, i) => (i === at ? pasted : v)));
      reject();
      return;
    }
    const others = linksIn(values.filter((_, i) => i !== at).join(' '));
    const fresh = linksIn([...others, ...found].join(' ')).slice(others.length);
    if (!fresh.length) {
      // The same video again: nothing was added, and saying nothing looked like a paste that failed.
      setError(ALREADY);
      haptic.light();
      // A passing note, not a fault to clear: it goes by itself.
      setTimeout(() => setError((e) => (e === ALREADY ? null : e)), 2600);
      return;
    }
    setError(null);
    haptic.light();
    const room = onSubmitMany ? LINKS_AT_ONCE : 1;
    setValues((vs) => {
      const next = [...vs];
      next[at] = fresh[0];
      // The rest go into the empty fields after this one, then into new ones, while there's room.
      for (const url of fresh.slice(1)) {
        const free = next.findIndex((v, i) => i > at && !v.trim());
        if (free >= 0) next[free] = url;
        else if (next.length < room) next.push(url);
      }
      return next;
    });
  };

  const type = (at: number) => (t: string) => {
    setValues((vs) => vs.map((v, i) => (i === at ? t : v)));
    setError(null);
  };

  const addField = () => {
    haptic.light();
    setError(null);
    setValues((vs) => [...vs, '']);
    focusAt.current = values.length;
    track('link field added', { fields: values.length + 1 });
  };

  const remove = (at: number) => {
    haptic.light();
    setError(null);
    setValues((vs) => {
      const left = vs.filter((_, i) => i !== at);
      return left.length ? left : [''];
    });
  };

  const pasteByHand = (at: number) => () => {
    haptic.light();
    setUnreadable(true);
    inputs.current[at]?.focus();
    track('paste failed');
  };

  // One field: paste until there's a link, then Go, one button always the next step. Over the sky it
  // rides inside the field's right end; on paper it sits beside it.
  const single = links.length ? (
    <Animated.View key="go" entering={FADE_IN}>
      <PressableScale
        onPress={submit}
        style={[styles.go, sky && styles.goSky]}
        accessibilityRole="button"
        accessibilityLabel="Go: find the places in this video"
      >
        <Icon name="arrow-right" size={20} color={light.ctaInk} />
      </PressableScale>
    </Animated.View>
  ) : (
    <PasteButton shape="circle" onText={fill(0)} onUnreadable={pasteByHand(0)} />
  );

  // Several fields: each holds its own video, with a way to take it out or to paste into it. The
  // one button under them reads them all, so there's no guessing which field's arrow to press.
  const trailing = (at: number) =>
    values[at].trim() ? (
      <PressableScale
        onPress={() => remove(at)}
        hitSlop={8}
        style={styles.clear}
        accessibilityRole="button"
        accessibilityLabel={`Remove video ${at + 1}`}
      >
        <Icon name="x" size={16} color={ink.soft} />
      </PressableScale>
    ) : (
      <PasteButton shape="circle" size={SMALL_CIRCLE} quiet onText={fill(at)} onUnreadable={pasteByHand(at)} />
    );

  const full = links.length >= LINKS_AT_ONCE;
  // A video typed into a second field that's already in another: it's read once, and said so.
  const keys = values.map((v) => {
    const l = linksIn(v)[0];
    return l ? linkKey(l) : null;
  });
  const repeated = keys.some((k, i) => k !== null && keys.indexOf(k) < i);
  // Another field once every field holds a video, for someone who has read one before.
  const canAdd = !!onSubmitMany && offerMore && !full && values.length < LINKS_AT_ONCE && values.every((v) => linksIn(v).length > 0);
  const hint =
    error ??
    (repeated ? ALREADY : null) ??
    (unreadable && !values.some((v) => v.trim()) ? UNREADABLE : null) ??
    (clipboardHasLink && !many && !values[0] ? 'You copied a link. Tap paste to add it.' : null);

  return (
    <View>
      <Animated.View style={[styles.fields, shakeStyle]}>
        {values.map((value, at) => {
          const platform = linksIn(value).length ? detectPlatform(linksIn(value)[0]) : null;
          return (
            <Animated.View key={at} entering={at > 0 ? FADE_IN : undefined} style={styles.row}>
              <View
                style={[
                  styles.field,
                  focused === at && styles.fieldFocused,
                  sky && styles.fieldSky,
                  sky && WEB_FROST,
                  sky && focused === at && styles.fieldSkyFocused,
                  many && styles.fieldMany,
                  !!error && styles.fieldError,
                ]}
              >
                <View style={styles.icon}>
                  {platform ? (
                    <Animated.View key={platform} entering={FADE_IN}>
                      <Ionicons name={platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'} size={18} color={ink.strong} />
                    </Animated.View>
                  ) : (
                    <Icon name="link" size={16} color={ink.faint} />
                  )}
                </View>
                <TextInput
                  ref={(r) => {
                    inputs.current[at] = r;
                    if (r && focusAt.current === at) {
                      focusAt.current = null;
                      r.focus();
                    }
                  }}
                  value={value}
                  onChangeText={type(at)}
                  onFocus={() => setFocused(at)}
                  onBlur={() => setFocused((f) => (f === at ? null : f))}
                  onSubmitEditing={submit}
                  placeholder={at === 0 ? 'Paste a video link' : 'Paste the next link'}
                  placeholderTextColor={ink.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  selectionColor={ink.strong}
                  style={[styles.input, sky && styles.inputSky, { color: ink.strong }, NO_FOCUS_RING]}
                  accessibilityLabel={at === 0 ? 'Link to an Instagram reel or post, or a YouTube video' : `Link to video ${at + 1}`}
                />
                {many ? trailing(at) : sky ? single : null}
              </View>
              {many || sky ? null : single}
            </Animated.View>
          );
        })}
      </Animated.View>

      <View style={styles.under}>
        {canAdd ? (
          <Animated.View entering={FADE_IN}>
            <PressableScale onPress={addField} style={styles.add} accessibilityRole="button" accessibilityLabel="Add another video">
              <Icon name="plus" size={16} color={ink.strong} />
              <Text variant="label" color={ink.strong} style={styles.addText}>
                Add another video
              </Text>
            </PressableScale>
          </Animated.View>
        ) : null}
        {many ? (
          <Animated.View entering={FADE_IN} style={styles.findWrap}>
            <Button
              trailingArrow
              label={links.length === 1 ? 'Find places in this video' : `Find places in ${links.length} videos`}
              onPress={submit}
              disabled={links.length === 0}
            />
            <Text variant="label" color={ink.soft} style={styles.most}>
              {full ? `${LINKS_AT_ONCE} is the most at once. Add more once these are read.` : `Up to ${LINKS_AT_ONCE} at a time.`}
            </Text>
          </Animated.View>
        ) : null}
        {hint ? (
          <Animated.View key={hint} entering={FADE_IN} exiting={FADE_OUT} style={styles.hint}>
            {error ? (
              <ErrorNote>{hint}</ErrorNote>
            ) : (
              <Text variant="label" color={ink.soft}>
                {hint}
              </Text>
            )}
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
    borderRadius: radii.field,
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
    borderRadius: radii.field,
    paddingRight: (SKY_HEIGHT - CIRCLE) / 2,
    // In the light look the field is a white pill floating on its shadow, like Airbnb's search bar:
    // it's the main thing on Home, so it sits highest. A grey line round it drew it flat.
    backgroundColor: isLight ? light.panel : skyFill.raised,
    borderColor: isLight ? 'transparent' : skyInk.rim,
    boxShadow: isLight ? shadows.float : 'none',
    ...(isLight ? { borderRadius: 999 } : null),
  },
  // A link that isn't one (or is already in): the border takes the error red.
  fieldError: { borderColor: skyDanger.line, borderWidth: 2 },
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
  input: { flex: 1, height: '100%', fontFamily: fonts.sans, fontSize: fontSize.title, color: light.ink },
  // The button rides inside the field here: a long link stops short of it instead of touching it.
  inputSky: { marginRight: 8 },
  fields: { gap: 8 },
  // Several fields stack tighter: the same field, less tall, so three and the button fit the screen.
  fieldMany: { height: HEIGHT, paddingRight: (HEIGHT - SMALL_CIRCLE) / 2 },
  clear: { width: SMALL_CIRCLE, height: SMALL_CIRCLE, alignItems: 'center', justifyContent: 'center' },
  // What's under the fields (Add, the button, a hint): close under them, so it reads as the field's
  // own (on a phone the hint sat a third of the way to the next card), and air before the card
  // below. With nothing to say it is only that air, not an empty band.
  under: { paddingTop: 6, paddingBottom: 12, gap: 10 },
  // A 44pt tap round the words, which line up with the field's own icon.
  add: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingLeft: 16, alignSelf: 'flex-start', paddingRight: 12 },
  addText: { fontFamily: fonts.sansSemi },
  findWrap: { gap: 8 },
  hint: { marginLeft: 4 },
  most: { marginLeft: 4 },
});
