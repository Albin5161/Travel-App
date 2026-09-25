import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typeLine } from '@/components/PlaceMeta';
import { Text } from '@/components/Text';
import type { TripStop } from '@/data/planner';
import type { Place } from '@/data/types';
import { light } from '@/theme/tokens';

type Props = {
  stop: TripStop | null;
  /** Labels for every day, e.g. "Day 2 · Sun 28"; the stop's own day is left out of "Move to". */
  days: string[];
  day: number;
  candidates: Place[];
  onPin: () => void;
  onMove: (to: number) => void;
  onSwap: (place: Place) => void;
  onRemove: () => void;
  onClose: () => void;
};

/**
 * Everything you can do to one stop, in a sheet from the bottom: pin it, move it to another day,
 * swap it for something else, or take it out. The list rows sit in thumb reach; the swap list only
 * opens when asked for, so the common actions stay one tap away.
 */
export function StopActions({ stop, days, day, candidates, onPin, onMove, onSwap, onRemove, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [swapping, setSwapping] = useState(false);
  const close = () => {
    setSwapping(false);
    onClose();
  };

  return (
    <Modal visible={!!stop} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
      {stop ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Image source={stop.place.photo} style={styles.thumb} contentFit="cover" transition={0} />
            <View style={styles.headText}>
              <Text variant="title" numberOfLines={1}>
                {stop.place.name}
              </Text>
              <Text variant="label" color={light.inkSoft} numberOfLines={1}>
                {typeLine(stop.place)}
                {stop.suggested ? ' · Suggested' : ''}
              </Text>
            </View>
          </View>

          {swapping ? (
            <ScrollView style={styles.swapList} contentContainerStyle={styles.swapContent}>
              <View style={styles.swapHead}>
                <Text variant="micro">Swap for</Text>
                <Pressable onPress={() => setSwapping(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to actions">
                  <Text variant="label" style={styles.back}>
                    Back
                  </Text>
                </Pressable>
              </View>
              {candidates.length === 0 ? (
                <Text variant="body">Nothing else to swap in yet. Save more places here and they&apos;ll show up.</Text>
              ) : (
                candidates.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setSwapping(false);
                      onSwap(p);
                    }}
                    style={({ pressed }) => [styles.candidate, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Swap for ${p.name}`}
                  >
                    <Image source={p.photo} style={styles.candidateThumb} contentFit="cover" transition={0} />
                    <View style={styles.headText}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text variant="label" color={light.inkSoft} numberOfLines={1}>
                        {typeLine(p)}
                        {p.source.kind === 'local' ? ' · Local pick' : ''}
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          ) : (
            <View style={styles.actions}>
              {!stop.suggested ? (
                <Action
                  icon="map-pin"
                  label={stop.pinned ? 'Unpin' : 'Pin to this day'}
                  detail={stop.pinned ? 'Regenerating may move it' : 'Regenerating keeps it here'}
                  onPress={onPin}
                />
              ) : null}
              {days.map((label, i) =>
                i === day ? null : <Action key={label} icon="corner-down-right" label={`Move to ${label}`} onPress={() => onMove(i)} />,
              )}
              <Action icon="repeat" label="Swap for something else" onPress={() => setSwapping(true)} />
              <Action icon="x" label="Remove from plan" detail={stop.suggested ? undefined : 'It stays saved'} onPress={onRemove} danger />
            </View>
          )}
        </View>
      ) : null}
    </Modal>
  );
}

function Action({
  icon,
  label,
  detail,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.actionIcon}>
        <Feather name={icon} size={16} color={light.ink} />
      </View>
      <View style={styles.headText}>
        <Text variant="bodyStrong" color={danger ? '#B3261E' : light.ink}>
          {label}
        </Text>
        {detail ? (
          <Text variant="label" color={light.inkSoft}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,17,17,0.32)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: light.panel,
    maxHeight: '80%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 2.5, backgroundColor: light.lineStrong, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: light.line },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: light.canvasTop },
  headText: { flex: 1, gap: 2 },
  actions: { paddingTop: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 14 },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: light.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: light.canvas },
  swapList: { maxHeight: 360 },
  swapContent: { paddingTop: 14, gap: 6 },
  swapHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { textDecorationLine: 'underline' },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 6, borderRadius: 14 },
  candidateThumb: { width: 44, height: 44, borderRadius: 11, backgroundColor: light.canvasTop },
});
