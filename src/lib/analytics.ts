// Usage counts, sent to PostHog: which steps people reach (paste → places found → saved → planned →
// shared → a friend joins) and whether they come back. Off until EXPO_PUBLIC_POSTHOG_KEY is set.
//
// Events carry counts and kinds only: never a link, a place, a name, a trip code or a location. The
// privacy policy (src/data/legal.ts) says so; change both together.

import { useSegments } from 'expo-router';
import PostHog from 'posthog-react-native';
import { useEffect } from 'react';

import { deviceStorage } from '@/lib/live/storage';
import { parseLink } from '@/server/links';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
// The project's region: the US cloud unless the key belongs to the EU one.
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Nothing on the server render (no storage there), nothing without a key.
const client =
  KEY && deviceStorage
    ? new PostHog(KEY, {
        host: HOST,
        customStorage: deviceStorage,
        // No location from the network address either: where people are isn't what's measured.
        disableGeoip: true,
      })
    : null;

// Your own testing on localhost stays separable from testers': filter on `build`.
client?.register({ build: __DEV__ ? 'dev' : 'live' });

export type AnalyticsEvent =
  | 'onboarding completed'
  | 'link pasted'
  | 'places found'
  | 'link failed'
  | 'places saved'
  | 'trip planned'
  | 'plan shared'
  | 'trip joined'
  | 'vote cast'
  | 'plan locked'
  | 'location asked'
  | 'paste failed';

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>) {
  client?.capture(event, properties);
}

/** "youtube", "instagram", or "other" for anything that isn't a link we read. */
export const platformOfLink = (url: string) => parseLink(url)?.platform ?? 'other';

/**
 * One screen view per route change, named by the route's pattern ("join/[code]", not the code
 * itself), so a friend's trip code never leaves the phone. Mounted once, in the root layout.
 */
export function ScreenViews() {
  const segments = useSegments();
  const name = segments.filter((s) => !s.startsWith('(')).join('/') || 'home';
  useEffect(() => {
    client?.screen(name);
  }, [name]);
  return null;
}
