import { useNetworkState } from 'expo-network';

import { useSettled } from '@/lib/onlineSettle';

// Whether there's a connection, on a phone: the system says (expo-network). Before it has answered,
// and whenever it isn't sure, the phone counts as online: a wrong "offline" is worse than none.

/** True while the device has no connection. Reading videos, search, the map and shared trips need one; saved places and plans don't. */
export function useOffline(): boolean {
  const state = useNetworkState();
  return useSettled(state.isConnected === false || state.isInternetReachable === false);
}
