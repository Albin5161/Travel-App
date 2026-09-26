import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { JoinTrip } from '@/components/JoinTrip';

/**
 * Joining by typing a code (from Trips). Older shared links put the code after a "?"; the web
 * server renders the page without it, so those move to /join/CODE, which it does see.
 */
export default function Join() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  useEffect(() => {
    if (Platform.OS !== 'web' || code) return;
    const fromLink = new URLSearchParams(window.location.search).get('code');
    if (fromLink) router.replace({ pathname: '/join/[code]', params: { code: fromLink } });
  }, [code]);
  return <JoinTrip linkCode={code} />;
}
