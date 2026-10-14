import { Redirect, Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { useAccount } from '@/lib/live/account';
import { liveEnabled } from '@/lib/live/client';
import { useArrivalWatch } from '@/state/arrival';
import { useTrips } from '@/state/trips';

// Home is Collect, Trips is every plan and who's in on it, Map is every saved spot, Profile is
// where home and notifications live.
// The city page, Pick and Plan are pushed over these tabs from the root stack, full-screen.
export default function TabsLayout() {
  // Held here so the geofences and the notification listeners live as long as the app does.
  useArrivalWatch();
  const { state } = useTrips();
  const { account } = useAccount();

  // Gated on the whole tab group, not just Home: restoring to /map or /profile, or following a
  // notification into a district, would otherwise walk straight past onboarding. Declarative, so
  // no tab paints before redirecting.
  if (!state.onboarded) return <Redirect href="/onboarding" />;
  // The name became required after some people had skipped it: they're asked for it once, alone.
  if (!state.myName) return <Redirect href={{ pathname: '/onboarding', params: { step: 'name' } }} />;
  // Then an email, asked of everyone (signin): it's how their places are backed up. Only where the
  // backend is set up; without it there's nothing to sign in to.
  if (liveEnabled && !account) return <Redirect href="/signin" />;

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
