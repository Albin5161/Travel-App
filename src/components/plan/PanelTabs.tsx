import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Tone } from '@/theme/tone';
import { fonts, light } from '@/theme/tokens';

import { TabIcon, type TabIconName } from './TabIcon';

export const PLAN_TABS = ['Overview', 'Places', 'Plan', 'Good to know'] as const;
const TAB_ICONS: TabIconName[] = ['overview', 'places', 'plan', 'safety'];

/** Grabber + tab row. */
export const PANEL_HEADER_H = 78;
export const PANEL_RADIUS = 32;

/** How much of the panel shows at rest, above the home indicator. */
export const restPeek = (insetBottom: number) => PANEL_HEADER_H + insetBottom + 8;

type Props = {
  active: number;
  /** Omit for a static copy (the growing card draws one so the hand-over is seamless). */
  onTab?: (index: number) => void;
};

// The top of the Plan panel: a grabber and the tabs. Still no underline — the active tab is its
// ink, and its icon, which performs a small gesture of its own as the section arrives. Weight never
// changes, so the tabs can't shift sideways. Scrolling the panel changes the active tab too
// (scroll-spy, in the screen).
export function PanelTabs({ active, onTab }: Props) {
  return (
    <Tone value="light">
      <View style={styles.header}>
        <View style={styles.grabber} />
        <View style={styles.row}>
          {PLAN_TABS.map((label, i) => (
            <Pressable
              key={label}
              onPress={onTab ? () => onTab(i) : undefined}
              disabled={!onTab}
              style={styles.tab}
              hitSlop={6}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === active }}
            >
              <TabIcon name={TAB_ICONS[i]} active={i === active} />
              <Animated.Text
                numberOfLines={1}
                style={[styles.label, { color: i === active ? light.ink : light.inkFaint }]}
              >
                {label}
              </Animated.Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.rule} />
      </View>
    </Tone>
  );
}

const styles = css.create({
  header: {
    height: PANEL_HEADER_H,
    backgroundColor: light.panel,
    borderTopLeftRadius: PANEL_RADIUS,
    borderTopRightRadius: PANEL_RADIUS,
  },
  grabber: {
    alignSelf: 'center',
    marginTop: 8,
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: light.lineStrong,
  },
  row: { flexDirection: 'row', paddingHorizontal: 10, marginTop: 8, height: 52 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    lineHeight: 15,
    transitionProperty: 'color',
    transitionDuration: '200ms',
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: light.line },
});
