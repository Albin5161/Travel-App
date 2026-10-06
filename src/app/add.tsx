import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { platformOfLink, track } from '@/lib/analytics';
import { linksIn } from '@/lib/links';
import { useTrips } from '@/state/trips';

/**
 * A link handed to Xplore from outside: xplore.expo.app/add?url=… on the web, xplore://add?url=… on
 * a phone. Whatever video links are in it are set to be read in the background, and Home opens,
 * where they wait. A share from an installed web app arrives the same way (`text` or `url`).
 */
export default function Add() {
  const { url, text } = useLocalSearchParams<{ url?: string; text?: string }>();
  const { dispatch } = useTrips();
  useEffect(() => {
    const urls = linksIn([url, text].filter(Boolean).join('\n'));
    if (!urls.length) return;
    track('link shared in', { count: urls.length, platform: platformOfLink(urls[0]) });
    dispatch({ type: 'inboxAdd', urls, from: 'share' });
  }, [dispatch, url, text]);
  return <Redirect href="/" />;
}
