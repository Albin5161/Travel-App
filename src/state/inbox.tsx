import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { extractPlaces, isSampleLink } from '@/data/api';
import type { Extraction } from '@/data/types';
import { ApiFailure } from '@/lib/api';
import { platformOfLink, track } from '@/lib/analytics';
import { readLink } from '@/lib/extract';
import { haptic } from '@/lib/haptics';
import { linksIn } from '@/lib/links';
import { sound } from '@/lib/sound';

import { useTrips } from './trips';

// Links that are read without a screen of their own: shared into the app from Instagram or YouTube,
// or pasted several at once. They're read one at a time, in the order they came, and each then
// waits on Home to be checked. Nothing is saved until it has been.

/** When this launch began: a link from before it was left waiting, and is worth a "here's what we found". */
const LAUNCHED_AT = Date.now();

const NO_PLACES = 'We couldn’t find any places in this one.';
const OUR_SIDE = 'Something went wrong on our side.';

/** Mounted once, at the root: takes shared links in, and reads whatever is waiting. */
export function InboxRunner() {
  const { state, dispatch } = useTrips();
  const next = state.inbox.find((i) => i.status === 'queued');
  // Reads can't be stopped once sent, so each is started once, whatever re-renders in between.
  const started = useRef(new Set<string>());

  useEffect(() => {
    if (!next || started.current.has(next.key)) return;
    const { key, url, from, at } = next;
    started.current.add(key);
    const startedAt = Date.now();
    const measure = { platform: platformOfLink(url), from, seconds: () => Math.round((Date.now() - startedAt) / 1000) };
    const failed = (problem: string, retryable: boolean, reason: string) => {
      started.current.delete(key);
      track('link failed', { platform: measure.platform, reason, seconds: measure.seconds(), away: true, from });
      dispatch({ type: 'inboxFailed', key, problem, retryable });
    };
    const found = (extraction: Extraction) => {
      started.current.delete(key);
      track('places found', { platform: measure.platform, count: extraction.places.length, seconds: measure.seconds(), away: true, from });
      // Pasted just now with the app open: its row turning ready on Home is the news. Shared in, or
      // left waiting from an earlier visit: it gets said, in the sheet.
      const watched = from === 'paste' && at >= LAUNCHED_AT && AppState.currentState === 'active';
      if (AppState.currentState === 'active') {
        haptic.success();
        void sound.play('found');
      }
      dispatch({ type: 'inboxRead', key, extraction, told: watched });
    };

    if (isSampleLink(url)) {
      void extractPlaces(url).then(found);
      return;
    }
    readLink(url)
      .then((outcome) => {
        if (outcome.kind === 'done') found(outcome.extraction);
        else failed(NO_PLACES, false, outcome.kind === 'empty' ? 'empty' : outcome.reason);
      })
      .catch((e: unknown) => {
        const error = e instanceof ApiFailure ? e : new ApiFailure('upstream', OUR_SIDE, true);
        failed(error.message, error.retryable, error.code);
      });
  }, [next, dispatch]);

  useSharedLinks((urls) => {
    track('link shared in', { count: urls.length, platform: platformOfLink(urls[0]) });
    dispatch({ type: 'inboxAdd', urls, from: 'share' });
  });

  return null;
}

/**
 * Links sent to Xplore from another app's share sheet (the phone apps only, and only in a build of
 * our own: Expo Go has no share sheet entry). Looked for when the app opens and each time it comes
 * back to the front, then cleared so a link is taken in once.
 */
function useSharedLinks(onLinks: (urls: string[]) => void) {
  const take = useRef(onLinks);
  useEffect(() => {
    take.current = onLinks;
  });
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const look = () => {
      try {
        const payloads = Sharing.getSharedPayloads();
        if (!payloads.length) return;
        const urls = linksIn(payloads.map((p) => p.value).join('\n'));
        Sharing.clearSharedPayloads();
        if (urls.length) take.current(urls);
      } catch {
        // No share sheet entry in this build: nothing to take in.
      }
    };
    look();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && look());
    return () => sub.remove();
  }, []);
}

// ── Whether the opening screen has finished ─────────────────────────────────────────────────────
// A sheet is drawn above everything, the opening screen included, so "here's what we found" waits
// for it to be over.

let introOver = false;
const waiting = new Set<() => void>();

export function introFinished() {
  introOver = true;
  waiting.forEach((tell) => tell());
}

export function useIntroOver() {
  return useSyncExternalStore(
    (tell) => {
      waiting.add(tell);
      return () => waiting.delete(tell);
    },
    () => introOver,
    () => introOver,
  );
}
