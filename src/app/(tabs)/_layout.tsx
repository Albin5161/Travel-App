import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { useArrivalWatch } from '@/state/arrival';

// Home is Collect, Map is every saved spot, Profile is where home and notifications live.
// The city page, Pick and Plan are pushed over these tabs from the root stack, full-screen.
export default function TabsLayout() {
  // Held here so the geofences and the notification listeners live as long as the app does.
  useArrivalWatch();

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
