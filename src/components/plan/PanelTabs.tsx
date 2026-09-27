import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Glass } from '@/components/sky/Glass';
import { Tone } from '@/theme/tone';
import { skyInk } from '@/theme/sky';
import { fonts, radii } from '@/theme/tokens';

import { TabIcon, type TabIconName } from './TabIcon';

export const PLAN_TABS = ['Overview', 'Places', 'Plan', 'Good to know'] as const;
const TAB_ICONS: TabIconName[] = ['overview', 'places', 'plan', 'safety'];

/** Grabber + tab row. */
export const PANEL_HEADER_H = 78;
export const PANEL_RADIUS = radii.sheet;

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
    <Tone value="sky">
      <Glass radius={PANEL_RADIUS} style={styles.header}>
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
                style={[styles.label, { color: i === active ? skyInk.strong : skyInk.faint }]}
              >
                {label}
              </Animated.Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.rule} />
      </Glass>
    </Tone>
  );
}

const styles = css.create({
  header: {
    height: PANEL_HEADER_H,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  grabber: {
    alignSelf: 'center',
    marginTop: 8,
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: skyInk.outline,
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
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: skyInk.line },
});
