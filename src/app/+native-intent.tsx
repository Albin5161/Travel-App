/**
 * Where the app opens when it's started from outside. A share from another app's share sheet opens
 * it at "expo-sharing", which isn't a screen: the shared link is picked up on Home (state/inbox).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return path.includes('expo-sharing') ? '/' : path;
}
