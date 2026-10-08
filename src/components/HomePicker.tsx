import Feather from '@expo/vector-icons/Feather';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { GlassSheet } from '@/components/sky/GlassSheet';
import { Text } from '@/components/Text';
import { allDistricts } from '@/data/regions';
import { haptic } from '@/lib/haptics';
import { useTrips } from '@/state/trips';
import { skyAccent, skyOnInk, skyInk } from '@/theme/sky';

/**
 * "Where's home?", asked where it matters (Near Home, distances on the map) rather than assumed:
 * home used to start as Kottayam, and everyone who skipped the intro measured from there unawares.
 */
export function HomePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, dispatch } = useTrips();
  return (
    <GlassSheet visible={visible} onClose={onClose}>
      <View style={styles.head}>
        <Text variant="headline" accessibilityRole="header">
          Where’s home?
        </Text>
        <Text variant="label" color={skyInk.soft}>
          Places within reach of it go under Near Home, and the map measures from it. Kerala for now.
        </Text>
      </View>
      <ScrollView style={styles.list}>
        {allDistricts.map((d) => {
          const on = d.id === state.homeDistrictId;
          return (
            <PressableScale
              key={d.id}
              pressedScale={0.99}
              onPress={() => {
                haptic.selection();
                dispatch({ type: 'setHomeDistrict', districtId: d.id });
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${d.name}, ${d.state}`}
            >
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text variant="body" color={skyInk.strong}>
                    {d.name}
                  </Text>
                  <Text variant="data" color={skyInk.faint}>
                    {d.state}
                  </Text>
                </View>
                {on ? (
                  <View style={styles.check}>
                    <Feather name="check" size={12} color={skyOnInk} />
                  </View>
                ) : null}
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  head: { gap: 6, paddingBottom: 12 },
  list: { maxHeight: 420 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: skyAccent, alignItems: 'center', justifyContent: 'center' },
});
