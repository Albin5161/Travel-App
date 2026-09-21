import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { detectPlatform } from '@/data/api';
import { SAMPLE_LINK } from '@/data/catalog';
import { haptic } from '@/lib/haptics';
import { FADE_IN, FADE_OUT } from '@/lib/motion';
import { useTrips } from '@/state/trips';
import { colors, fonts } from '@/theme/tokens';

const SOURCES = [
  { id: 'instagram', icon: 'logo-instagram', label: 'Instagram' },
  { id: 'youtube', icon: 'logo-youtube', label: 'YouTube' },
] as const;

export default function Paste() {
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const { dispatch } = useTrips();
  const [url, setUrl] = useState(prefill ?? '');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const platform = detectPlatform(url);

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  const submit = () => {
    if (!platform) {
      setError("That doesn't look like an Instagram or YouTube link.");
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
      return;
    }
    dispatch({ type: 'setPendingLink', url: url.trim() });
    router.back();
    router.push('/analysing');
  };

  const pasteFromClipboard = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) {
      setUrl(text);
      setError(null);
    }
  };

  return (
    <View style={styles.sheet}>
      <Text variant="headline">Paste a link</Text>
      <Text variant="body" style={styles.sub}>
        Any Instagram reel or YouTube video with places in it.
      </Text>

      <View style={styles.sources}>
        {SOURCES.map((s) => {
          const lit = url.length === 0 ? 0.7 : platform === s.id ? 1 : 0.3;
          return (
            <Animated.View key={s.id} style={[styles.source, { opacity: lit }]}>
              <Ionicons name={s.icon} size={16} color={colors.mist} />
              <Text variant="label">{s.label}</Text>
            </Animated.View>
          );
        })}
      </View>

      <Animated.View style={[styles.field, focused && styles.fieldFocused, shakeStyle]}>
        <TextInput
          value={url}
          onChangeText={(t) => {
            setUrl(t);
            setError(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={submit}
          placeholder="instagram.com/reel/… or youtu.be/…"
          placeholderTextColor={colors.stone}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          selectionColor={colors.ember}
          style={styles.input}
          accessibilityLabel="Link to an Instagram reel or YouTube video"
        />
        <PressableScale onPress={pasteFromClipboard} style={styles.pasteChip} accessibilityRole="button">
          <Text variant="label">Paste</Text>
        </PressableScale>
      </Animated.View>

      {error ? (
        <Animated.View entering={FADE_IN} exiting={FADE_OUT}>
          <Text variant="label" color={colors.ash} style={styles.error}>
            {error}
          </Text>
        </Animated.View>
      ) : null}

      <Button label="Find places" onPress={submit} disabled={url.trim().length === 0} style={styles.cta} />
      <Button
        kind="text"
        label="Try a sample link"
        trailingArrow
        onPress={() => {
          setUrl(SAMPLE_LINK);
          setError(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.basalt, paddingHorizontal: 24, paddingTop: 28 },
  sub: { marginTop: 6 },
  sources: { flexDirection: 'row', gap: 10, marginTop: 20 },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.rim,
    transitionProperty: 'opacity',
    transitionDuration: '180ms',
  },
  field: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 18,
    paddingLeft: 16,
    paddingRight: 8,
    backgroundColor: colors.night,
    borderWidth: 1,
    borderColor: colors.rim,
    transitionProperty: 'borderColor',
    transitionDuration: '180ms',
  },
  fieldFocused: { borderColor: colors.rimStrong },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.mist, height: '100%' },
  pasteChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.glassLight,
  },
  error: { marginTop: 10 },
  cta: { marginTop: 18 },
});
