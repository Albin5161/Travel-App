import { Redirect, Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { useArrivalWatch } from '@/state/arrival';
import { useTrips } from '@/state/trips';

// Home is Collect, Trips is every plan and who's in on it, Map is every saved spot, Profile is
// where home and notifications live.
// The city page, Pick and Plan are pushed over these tabs from the root stack, full-screen.
export default function TabsLayout() {
  // Held here so the geofences and the notification listeners live as long as the app does.
  useArrivalWatch();
  const { state } = useTrips();

  // Gated on the whole tab group, not just Home: restoring to /map or /profile, or following a
  // notification into a district, would otherwise walk straight past onboarding. Declarative, so
  // no tab paints before redirecting.
  if (!state.onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
