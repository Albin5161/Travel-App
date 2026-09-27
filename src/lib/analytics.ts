// Usage counts, sent to PostHog: which steps people reach (paste → places found → saved → planned →
// shared → a friend joins) and whether they come back. Off until EXPO_PUBLIC_POSTHOG_KEY is set.
//
// Events carry counts and kinds only: never a link, a place, a name, a trip code or a location. The
// privacy policy (src/data/legal.ts) says so; change both together.

import { useSegments } from 'expo-router';
import type PostHog from 'posthog-react-native';
import { useEffect } from 'react';

import { deviceStorage } from '@/lib/live/storage';
import { parseLink } from '@/server/links';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
// The project's region: the US cloud unless the key belongs to the EU one.
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Nothing on the server render (no storage there), nothing without a key.
const ON = !!KEY && !!deviceStorage;
// The PostHog library is about a sixth of the app's code and nothing on screen needs it, so it's
// fetched a moment after the first screen is up. Events before then wait in a short queue.
const LOAD_AFTER_MS = 2500;
const QUEUE_MAX = 50;
let client: PostHog | null = null;
let queue: ((c: PostHog) => void)[] = [];
let loading = false;

function load() {
  if (loading || !ON) return;
  loading = true;
  setTimeout(() => {
    import('posthog-react-native')
      .then(({ default: PostHogClient }) => {
        const c = new PostHogClient(KEY!, {
          host: HOST,
          customStorage: deviceStorage!,
          // No location from the network address either: where people are isn't what's measured.
          disableGeoip: true,
        });
        // Your own testing on localhost stays separable from testers': filter on `build`.
        c.register({ build: __DEV__ ? 'dev' : 'live' });
        client = c;
        queue.forEach((f) => f(c));
        queue = [];
      })
      .catch(() => {
        // No analytics this session; the app is unaffected.
        queue = [];
      });
  }, LOAD_AFTER_MS);
}

function withClient(f: (c: PostHog) => void) {
  if (client) return f(client);
  if (!ON) return;
  if (queue.length < QUEUE_MAX) queue.push(f);
  load();
}

export type AnalyticsEvent =
  | 'onboarding completed'
  | 'link pasted'
  | 'places found'
  | 'link failed'
  | 'places saved'
  | 'trip planned'
  | 'plan shared'
  | 'plan image saved'
  | 'trip joined'
  | 'vote cast'
  | 'plan locked'
  | 'location asked'
  | 'paste failed'
  | 'app crashed';

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>) {
  withClient((c) => c.capture(event, properties));
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
    withClient((c) => void c.screen(name));
  }, [name]);
  return null;
}
