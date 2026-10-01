import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { typeLine } from '@/components/PlaceMeta';
import { GlassSheet } from '@/components/sky/GlassSheet';
import { Text } from '@/components/Text';
import type { TripStop } from '@/data/planner';
import type { Place } from '@/data/types';
import { skyFill, skyInk, skySignal } from '@/theme/sky';
import { fonts } from '@/theme/tokens';

/** From this many places, scrolling for one is a chore: the swap list gets a search. */
const SEARCH_FROM = 9;

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
 * Everything you can do to one stop, in a sheet from the bottom: lock it, move it to another day,
 * swap it for something else, or take it out. The list rows sit in thumb reach; the swap list only
 * opens when asked for, so the common actions stay one tap away.
 */
export function StopActions({ stop, days, day, candidates, onPin, onMove, onSwap, onRemove, onClose }: Props) {
  const [swapping, setSwapping] = useState(false);
  const [query, setQuery] = useState('');
  const swapTo = (on: boolean) => {
    setSwapping(on);
    setQuery('');
  };
  const close = () => {
    swapTo(false);
    onClose();
  };
  // By name, area or kind: "momos", "hauz khas", "stay".
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length
    ? candidates.filter((p) => {
        const text = `${p.name} ${typeLine(p)}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
    : candidates;

  return (
    <GlassSheet visible={!!stop} onClose={close}>
      {stop ? (
        <>
          <View style={styles.head}>
            <Image source={stop.place.photo} style={styles.thumb} contentFit="cover" transition={0} />
            <View style={styles.headText}>
              <Text variant="title" numberOfLines={1}>
                {stop.place.name}
              </Text>
              <Text variant="label" color={skyInk.soft} numberOfLines={1}>
                {typeLine(stop.place)}
                {stop.suggested ? ' · Suggested' : ''}
              </Text>
            </View>
          </View>

          {swapping ? (
            <>
            <View style={styles.swapTop}>
              <View style={styles.swapHead}>
                <Text variant="micro">Swap for</Text>
                <Pressable onPress={() => swapTo(false)} hitSlop={10} style={styles.backTap} accessibilityRole="button" accessibilityLabel="Back to actions">
                  <Text variant="label" style={styles.back}>
                    Back
                  </Text>
                </Pressable>
              </View>
              {candidates.length >= SEARCH_FROM ? (
                <View style={styles.search}>
                  <Feather name="search" size={16} color={skyInk.soft} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={`Search ${candidates.length} places`}
                    placeholderTextColor={skyInk.faint}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                    style={styles.searchInput}
                    accessibilityLabel="Search the places you can swap in"
                  />
                  {query ? (
                    <Pressable onPress={() => setQuery('')} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear search">
                      <Feather name="x" size={14} color={skyInk.soft} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
            <ScrollView style={styles.swapList} contentContainerStyle={styles.swapContent} keyboardShouldPersistTaps="handled">
              {candidates.length === 0 ? (
                <Text variant="body">Nothing else to swap in yet. Save more places here and they&apos;ll show up.</Text>
              ) : shown.length === 0 ? (
                <Text variant="body">No place here matches “{query.trim()}”.</Text>
              ) : (
                shown.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      swapTo(false);
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
                      <Text variant="label" color={skyInk.soft} numberOfLines={1}>
                        {typeLine(p)}
                        {p.source.kind === 'local' ? ' · Local pick' : ''}
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
            </>
          ) : (
            <View style={styles.actions}>
              {!stop.suggested ? (
                <Action
                  icon={stop.pinned ? 'unlock' : 'lock'}
                  label={stop.pinned ? 'Unlock' : 'Lock in place'}
                  detail={stop.pinned ? 'Reshuffle can move it again' : 'Reshuffle keeps it on this day'}
                  onPress={onPin}
                />
              ) : null}
              {days.map((label, i) =>
                i === day ? null : <Action key={label} icon="corner-down-right" label={`Move to ${label}`} onPress={() => onMove(i)} />,
              )}
              {/* Remove sits above the last row, away from where the plan's Save button is. */}
              <Action icon="x" label="Remove from plan" detail={stop.suggested ? undefined : 'It stays saved'} onPress={onRemove} danger />
              <Action icon="repeat" label="Swap for something else" onPress={() => swapTo(true)} />
            </View>
          )}
        </>
      ) : null}
    </GlassSheet>
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
        <Feather name={icon} size={16} color={danger ? skySignal.down : skyInk.strong} />
      </View>
      <View style={styles.headText}>
        <Text variant="bodyStrong" color={danger ? skySignal.down : skyInk.strong}>
          {label}
        </Text>
        {detail ? (
          <Text variant="label" color={skyInk.soft}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: skyInk.line },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: skyFill.raised },
  headText: { flex: 1, gap: 2 },
  actions: { paddingTop: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 14 },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: skyFill.pane,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: skyFill.pane },
  swapTop: { paddingTop: 14, gap: 6 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: 999,
    backgroundColor: skyFill.pane,
  },
  // 16pt: an iPhone zooms the page into any smaller field.
  searchInput: { flex: 1, height: 48, fontFamily: fonts.sans, fontSize: 16, color: skyInk.strong, outlineStyle: 'none' } as object,
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  swapList: { maxHeight: 360 },
  swapContent: { paddingTop: 8, gap: 6 },
  swapHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { textDecorationLine: 'underline' },
  backTap: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 6, borderRadius: 14 },
  candidateThumb: { width: 44, height: 44, borderRadius: 11, backgroundColor: skyFill.raised },
});
