import { useSyncExternalStore } from 'react';

import { useSettled } from '@/lib/onlineSettle';

// Whether there's a connection, on the web: the browser says. Phones ask the system instead
// (online.native.ts).

function subscribe(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/** True while the device has no connection. Reading videos, search, the map and shared trips need one; saved places and plans don't. */
export function useOffline(): boolean {
  const offline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
  return useSettled(offline);
}
