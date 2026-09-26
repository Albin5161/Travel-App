import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { JoinTrip } from '@/components/JoinTrip';

/**
 * Joining by typing a code (from Trips). Older shared links put the code after a "?"; the web
 * server renders the page without it, so those reload as /join/CODE, which it does see. A plain
 * browser redirect: the router isn't ready this early on a cold load and would ignore it.
 */
export default function Join() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  useEffect(() => {
    if (Platform.OS !== 'web' || code) return;
    const fromLink = new URLSearchParams(window.location.search).get('code');
    if (fromLink && /^[A-Za-z0-9]{6}$/.test(fromLink)) window.location.replace(`/join/${fromLink.toUpperCase()}`);
  }, [code]);
  return <JoinTrip linkCode={code} />;
}
