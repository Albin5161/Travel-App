import { useLocalSearchParams } from 'expo-router';

import { JoinTrip } from '@/components/JoinTrip';

/** A shared trip's link: /join/CODE. The code is in the path so the web server renders it too. */
export default function JoinFromLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <JoinTrip linkCode={code} />;
}
