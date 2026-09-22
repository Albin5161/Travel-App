import { useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/Button';
import { PlaceCard } from '@/components/PlaceCard';
import { Text } from '@/components/Text';
import { getPlace } from '@/data/api';
import { useTrips } from '@/state/trips';
import { light } from '@/theme/tokens';

export default function PlaceSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = getPlace(id);
  const { state, dispatch } = useTrips();
  const { height: H } = useWindowDimensions();
  if (!place) return null;

  const skipped = !!state.skipped[place.id];
  const openMaps = () =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${place.coords.lat},${place.coords.lng}`);

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <PlaceCard place={place} style={{ height: Math.min(H * 0.56, 480) }} />
      <View style={styles.actions}>
        <Button kind="secondary" label="Open in Maps" onPress={openMaps} style={styles.action} />
        <Button
          kind={skipped ? 'primary' : 'secondary'}
          label={skipped ? 'Keep in trip' : 'Skip this one'}
          onPress={() => dispatch({ type: 'decide', placeId: place.id, keep: skipped })}
          style={styles.action}
        />
      </View>
      {skipped ? (
        <Text variant="label" color={light.inkFaint} style={styles.note}>
          Skipped. It won’t be in your day plan.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.panel },
  content: { padding: 16, paddingTop: 24, paddingBottom: 40 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  action: { flex: 1 },
  note: { marginTop: 12, textAlign: 'center' },
});
