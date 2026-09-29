import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { Tick } from '@/components/sky/Tick';
import { Text } from '@/components/Text';
import { getCity } from '@/data/api';
import { isCustom } from '@/data/custom';
import { formatDay, formatRange } from '@/data/planner';
import type { Place } from '@/data/types';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { useTrips } from '@/state/trips';
import { skyFill, skyInk } from '@/theme/sky';
import { radii, space } from '@/theme/tokens';

/**
 * After the trip: which of its places you made it to. Ticked ones are marked as been (grey on the
 * map, left out of weekend ideas, counted on Profile). Asked once per trip, from Home.
 */
export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const city = getCity(id);
  const plan = state.tripPlans[id];
  // Each place once, in the order they were planned, with the day it was on; typed-in stops
  // aren't places to mark.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: { place: Place; day: string }[] = [];
    plan?.days.forEach((d, i) =>
      d.stops.forEach((s) => {
        if (isCustom(s.place) || seen.has(s.place.id)) return;
        seen.add(s.place.id);
        out.push({ place: s.place, day: d.date ? formatDay(d.date) : `Day ${i + 1}` });
      }),
    );
    return out;
  }, [plan]);
  const [been, setBeen] = useState<Set<string>>(() => new Set(rows.filter((r) => state.spotStatus[r.place.id] === 'been').map((r) => r.place.id)));

  if (!city || !plan) return null;
  const allOn = rows.length > 0 && rows.every((r) => been.has(r.place.id));
  const start = plan.days[0]?.date;

  const toggle = (placeId: string) => {
    haptic.selection();
    setBeen((b) => {
      const next = new Set(b);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  };
  const finish = (ids: string[]) => {
    dispatch({ type: 'finishRecap', cityId: id, been: ids });
    track('trip recapped', { places: rows.length, been: ids.length });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SkyScreen style={{ paddingTop: insets.top + 8 }}>
      <IconButton icon="x" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Close" style={styles.close} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Text variant="eyebrow">
          {city.name}
          {start ? ` · ${formatRange(start, plan.days.length)}` : ''}
        </Text>
        <Text variant="display" accessibilityRole="header" style={styles.title}>
          Did you make it?
        </Text>
        <Text variant="body" style={styles.lede}>
          Tick the places you went to. They’ll show as been on your map, stay out of weekend ideas,
          and count on your profile.
        </Text>

        <Pressable
          onPress={() => {
            haptic.selection();
            setBeen(allOn ? new Set() : new Set(rows.map((r) => r.place.id)));
          }}
          style={styles.all}
          accessibilityRole="button"
        >
          <Text variant="label" color={skyInk.soft}>
            {allOn ? 'Clear all' : 'I went to all of them'}
          </Text>
        </Pressable>

        <View style={styles.list}>
          {rows.map(({ place, day }) => {
            const on = been.has(place.id);
            return (
              <Pressable
                key={place.id}
                onPress={() => toggle(place.id)}
                style={styles.row}
                accessibilityRole="checkbox"
                aria-checked={on}
                accessibilityLabel={`${place.name}, ${day}`}
              >
                <Image source={place.photo} style={[styles.thumb, !on && styles.thumbOff]} contentFit="cover" transition={0} />
                <View style={styles.rowText}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {place.name}
                  </Text>
                  <Text variant="data" numberOfLines={1}>
                    {day}
                  </Text>
                </View>
                <Tick on={on} />
              </Pressable>
            );
          })}
        </View>

        <Button
          label={been.size === 0 ? 'Save' : `Save ${been.size} ${been.size === 1 ? 'place' : 'places'}`}
          onPress={() => {
            haptic.success();
            finish([...been]);
          }}
          disabled={been.size === 0}
          style={styles.cta}
        />
        <Button kind="text" label="We didn’t go" onPress={() => finish([])} />
      </ScrollView>
    </SkyScreen>
  );
}

const styles = StyleSheet.create({
  close: { marginLeft: space.screen },
  pad: { paddingHorizontal: space.screen, paddingTop: 20 },
  title: { marginTop: 6, marginBottom: 10 },
  lede: { marginBottom: 8 },
  all: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  list: { gap: 8, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    paddingRight: 14,
    minHeight: 64,
    borderRadius: radii.pane,
    backgroundColor: skyFill.pane,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.line,
  },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: skyFill.raised },
  thumbOff: { opacity: 0.7 },
  rowText: { flex: 1, gap: 1 },
  cta: { marginTop: 24 },
});
