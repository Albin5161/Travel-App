import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ICONS_3D } from '@/components/icons3d';
import { Icon3D } from '@/components/Icon3D';

export type TabIconName = 'overview' | 'places' | 'plan' | 'safety';

const PICTURE: Record<TabIconName, keyof typeof ICONS_3D> = {
  overview: 'guide',
  places: 'spots',
  plan: 'calendar',
  safety: 'shield',
};

type Props = { name: TabIconName; active: boolean; pressed?: boolean; size?: number };

/**
 * The city page's tabs as 3D pictures, like Home's switch (Albin, 31 Oct 2026): the chosen tab in
 * full colour, the others faded. A finger squashes the picture, and whenever a tab becomes the
 * section you're in — a tap or the scroll arriving — it hops and plays its story: the guidebook's
 * page glints, the pin lands, the calendar's day is ringed, the shield's star glints.
 */
export function TabIcon({ name, active, pressed = false, size = 28 }: Props) {
  const [played, setPlayed] = useState(0);
  const was = useRef(active);
  useEffect(() => {
    if (active && !was.current) setPlayed((n) => n + 1);
    was.current = active;
  }, [active]);
  const icon = ICONS_3D[PICTURE[name]];
  return <Icon3D source={icon.source} size={size} story={icon.story} pressed={pressed} played={played} style={!active && styles.off} />;
}

const styles = StyleSheet.create({
  off: { opacity: 0.55 },
});
