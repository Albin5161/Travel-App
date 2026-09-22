import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Tone } from '@/theme/tone';
import { fonts, light } from '@/theme/tokens';

export const PLAN_TABS = ['Overview', 'Places', 'Plan', 'Good to know'] as const;
/** Grabber + tab row. */
export const PANEL_HEADER_H = 64;
export const PANEL_RADIUS = 32;

/** How much of the panel shows at rest, above the home indicator. */
export const restPeek = (insetBottom: number) => PANEL_HEADER_H + insetBottom + 8;

type Props = {
  active: number;
  /** Omit for a static copy (the growing card draws one so the hand-over is seamless). */
  onTab?: (index: number) => void;
};

// The top of the Plan panel: a grabber and the tabs. The active tab is marked by its text alone:
// ink when active, faint otherwise, crossfading in 180ms. Scrolling the panel changes it too
// (scroll-spy, in the screen). Weight stays the same so the tabs never shift sideways.
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
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === active }}
            >
              <Animated.Text style={[styles.tab, { color: i === active ? light.ink : light.inkFaint }]}>
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
  row: { flexDirection: 'row', gap: 22, paddingHorizontal: 24, marginTop: 16, height: 34 },
  tab: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    transitionProperty: 'color',
    transitionDuration: '180ms',
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: light.line },
});
