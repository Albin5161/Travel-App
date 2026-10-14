import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { SkyScreen } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { finishFromLink } from '@/lib/live/account';
import { skyInk } from '@/theme/sky';

/**
 * Where Google sends someone back after "Continue with Google" (lib/live/account). On the web this
 * is a page load of its own; on a phone the sign-in sheet usually catches the link before the app
 * does, and this only shows if it doesn't. Either way it finishes signing in and returns to Profile.
 */
export default function Auth() {
  const params = useLocalSearchParams<{ code?: string; error_code?: string; error_description?: string; error?: string }>();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void finishFromLink(params).then((next) => {
      if (next !== 'away') router.replace('/profile');
    });
  }, [params]);
  return (
    <SkyScreen style={styles.fill}>
      <ActivityIndicator color={skyInk.strong} />
      <Text variant="body" color={skyInk.soft}>
        Signing you in…
      </Text>
    </SkyScreen>
  );
}

const styles = StyleSheet.create({
  fill: { alignItems: 'center', justifyContent: 'center', gap: 12 },
});
