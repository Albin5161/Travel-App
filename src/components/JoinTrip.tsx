import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { joinTrip, loadTrip, planFromRow } from '@/lib/live/api';
import { ensureUser, liveEnabled } from '@/lib/live/client';
import { FADE_IN, fadeUp } from '@/lib/motion';
import { startGroup } from '@/state/group';
import { useTrips } from '@/state/trips';
import { fonts, light } from '@/theme/tokens';

const ENTER = [0, 1, 2, 3].map((i) => fadeUp(60 + i * 60));

/**
 * Joining someone's trip: from the link they sent (`linkCode`, from /join/CODE), or by typing the
 * code in Trips. Your name, then you're in the vote with everyone else, live. Joining replaces any
 * plan this phone already had for the same city.
 */
export function JoinTrip({ linkCode }: { linkCode?: string }) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const [code, setCode] = useState((linkCode ?? '').toUpperCase());
  // Came from a shared link (the code is in it), not typed in from Trips.
  const invited = !!linkCode;
  const [name, setName] = useState(state.myName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = code.trim().length === 6 && name.trim().length > 0;

  const join = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const row = await joinTrip(code, name.trim());
      const me = await ensureUser();
      const { members } = await loadTrip(row.id);
      const plan = planFromRow(row);
      dispatch({ type: 'setMyName', name: name.trim() });
      dispatch({ type: 'setTripPlan', plan });
      dispatch({
        type: 'setRemote',
        cityId: row.city_id,
        remote: {
          tripId: row.id,
          code: row.code,
          me,
          owner: row.owner,
          ownerName: members.find((m) => m.user_id === row.owner)?.name ?? 'Your friend',
        },
      });
      startGroup(dispatch, plan, true, row.swap_for);
      haptic.success();
      router.replace({ pathname: '/group/[id]', params: { id: row.city_id, welcome: '1' } });
    } catch (e) {
      haptic.error();
      const message = e instanceof Error ? e.message : '';
      setError(message.includes('No trip') ? 'No trip with that code. Check the letters and try again.' : 'Couldn’t reach Xplore. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/trips'));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <IconButton icon="x" onPress={close} accessibilityLabel="Close" />
      </View>

      <View style={styles.body}>
        <Animated.View entering={ENTER[0]}>
          <Text variant="micro">Plan it together</Text>
          <Text variant="display" style={styles.title}>
            {invited ? 'You’re invited' : 'Join a trip'}
          </Text>
          <Text variant="body">
            {invited
              ? 'A friend is planning a trip and wants your say. Add your name to see the places they picked and vote on each one.'
              : 'Keep, swap or drop each stop, add your own, and see everyone else’s votes as they land.'}
          </Text>
        </Animated.View>

        {!liveEnabled ? (
          <Animated.View entering={ENTER[1]} style={styles.offline}>
            <Feather name="cloud-off" size={16} color={light.inkSoft} />
            <Text variant="data" style={styles.flex}>
              Joining needs Xplore&rsquo;s server, and this build isn&rsquo;t connected to one yet.
            </Text>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={ENTER[1]} style={styles.field}>
              <Text variant="micro">Trip code</Text>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                placeholderTextColor={light.inkFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.input, styles.code]}
                accessibilityLabel="Trip code"
              />
            </Animated.View>
            <Animated.View entering={ENTER[2]} style={styles.field}>
              <Text variant="micro">Your name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="What should they call you?"
                placeholderTextColor={light.inkFaint}
                autoCapitalize="words"
                maxLength={40}
                returnKeyType="go"
                onSubmitEditing={join}
                style={styles.input}
                accessibilityLabel="Your name"
              />
            </Animated.View>
            {error ? (
              <Animated.View entering={FADE_IN}>
                <Text variant="label" color={light.accent}>
                  {error}
                </Text>
              </Animated.View>
            ) : null}
          </>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {liveEnabled ? (
          <Button label={busy ? 'Joining…' : 'Join trip'} onPress={join} disabled={!ready || busy} />
        ) : (
          <Button kind="secondary" label="Back" onPress={close} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  top: { paddingHorizontal: 16, flexDirection: 'row' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 20, gap: 20 },
  title: { marginTop: 6, marginBottom: 8 },
  flex: { flex: 1 },
  field: { gap: 8 },
  input: {
    height: 54,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: light.field,
    borderWidth: 1,
    borderColor: light.line,
    fontFamily: fonts.sansMedium,
    fontSize: 17,
    color: light.ink,
  },
  code: { fontFamily: fonts.displayBold, fontSize: 24, letterSpacing: 6 },
  offline: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 18,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
  },
  footer: { paddingHorizontal: 20 },
});
