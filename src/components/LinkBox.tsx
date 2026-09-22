import { Feather, Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
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
};

const HEIGHT = 48;
const ERROR = "That's not an Instagram or YouTube link.";

// The home screen's link field: type or paste a reel link, or tap the system Paste button beside it.
export function LinkBox({ onSubmit, clipboardHasLink }: Props) {
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
            placeholder="Paste a reel or YouTube link"
            placeholderTextColor={light.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectionColor={light.ink}
            style={styles.input}
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
        ) : null}
      </View>
    </View>
  );
}

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
  input: { flex: 1, height: '100%', fontFamily: fonts.sans, fontSize: 15, color: light.ink, outlineWidth: 0 },
  hintSlot: { minHeight: 26, justifyContent: 'center' },
  hint: { textAlign: 'center', marginTop: 8 },
});
