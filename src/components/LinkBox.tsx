import { Feather, Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Keyboard, Platform, Pressable, TextInput, View, type TextStyle } from 'react-native';
import Animated, { css, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { PasteButton } from '@/components/PasteButton';
import { Text } from '@/components/Text';
import { detectPlatform } from '@/data/api';
import { haptic } from '@/lib/haptics';
import { FADE_IN, FADE_OUT } from '@/lib/motion';
import { fonts, light, shadows } from '@/theme/tokens';

type Props = {
  onSubmit: (url: string) => void;
  /** A link is on the clipboard (checked without reading it, so no iOS alert). */
  clipboardHasLink?: boolean;
  /** Offered in the hint line when nothing else needs saying: for demos and first runs. */
  onExample?: () => void;
};

const HEIGHT = 48;
const ERROR = "That's not an Instagram or YouTube link.";

// The home screen's link field: type or paste a video link, or tap the system Paste button beside it.
export function LinkBox({ onSubmit, clipboardHasLink, onExample }: Props) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const platform = detectPlatform(value);

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
    const url = text.trim();
    if (!url) return;
    if (!detectPlatform(url)) {
      setValue(url);
      reject();
      return;
    }
    Keyboard.dismiss();
    setValue('');
    setError(null);
    onSubmit(url);
  };

  const hint = error ?? (clipboardHasLink && !value ? 'You copied a link. Tap paste to add it.' : null);

  return (
    <View>
      <View style={styles.row}>
        <Animated.View style={[styles.field, focused && styles.fieldFocused, shakeStyle]}>
          <View style={styles.icon}>
            {platform ? (
              <Animated.View key={platform} entering={FADE_IN}>
                <Ionicons
                  name={platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'}
                  size={18}
                  color={light.ink}
                />
              </Animated.View>
            ) : (
              <Feather name="link" size={16} color={light.inkFaint} />
            )}
          </View>
          <TextInput
            value={value}
            onChangeText={(t) => {
              setValue(t);
              setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => submit(value)}
            placeholder="Paste a video link"
            placeholderTextColor={light.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectionColor={light.ink}
            style={[styles.input, NO_FOCUS_RING]}
            accessibilityLabel="Link to an Instagram reel or YouTube video"
          />
        </Animated.View>
        <PasteButton shape="circle" onText={submit} />
      </View>
      <View style={styles.hintSlot}>
        {hint ? (
          <Animated.View key={hint} entering={FADE_IN} exiting={FADE_OUT}>
            <Text variant="label" color={error ? light.ink : light.inkSoft} style={styles.hint}>
              {hint}
            </Text>
          </Animated.View>
        ) : onExample && !value ? (
          <Animated.View entering={FADE_IN} exiting={FADE_OUT} style={styles.exampleRow}>
            <Text variant="label" color={light.inkFaint}>
              No link handy?
            </Text>
            <Pressable onPress={onExample} hitSlop={10} accessibilityRole="button">
              <Text variant="label" style={styles.exampleLink}>
                Try an example
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

// Web only: the browser draws its own focus ring round the inner input, in the system accent colour
// and narrower than the pill. outlineWidth: 0 isn't enough, since Chrome's 'auto' ring ignores width.
// The pill's darker border is the focus state. RN's types don't list 'none', hence the cast.
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = css.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  icon: { width: 20, alignItems: 'center', marginRight: 10 },
  input: { flex: 1, height: '100%', fontFamily: fonts.sans, fontSize: 15, color: light.ink },
  hintSlot: { minHeight: 26, justifyContent: 'center' },
  hint: { textAlign: 'center', marginTop: 8 },
  exampleRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 },
  exampleLink: { textDecorationLine: 'underline' },
});
