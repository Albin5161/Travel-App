import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Chips } from '@/components/spots/Chips';
import { Text } from '@/components/Text';
import { customPlace } from '@/data/custom';
import { addCustomStop, formatDay } from '@/data/planner';
import type { DayPart } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { usePlanWriter } from '@/state/live';
import { useTrips } from '@/state/trips';
import { fonts, light } from '@/theme/tokens';

const PARTS: { key: DayPart; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
];
const LENGTHS = [
  { key: 30, label: '30 min' },
  { key: 60, label: '1 hour' },
  { key: 120, label: '2 hours' },
  { key: 240, label: 'Half a day' },
];
const RANK: Record<DayPart, number> = { morning: 0, afternoon: 1, evening: 2 };

/**
 * Your own stop, in your own words: "Lunch at Ammachi's", "Pick up Amma, 7:00". It goes into the
 * plan in its part of the day and, on a shared trip, onto everyone's phone, where it waits for votes
 * like any other stop. Opened from the plan (on a given day) or from the vote.
 */
export default function AddStop() {
  const { id, day: dayParam } = useLocalSearchParams<{ id: string; day?: string }>();
  const insets = useSafeAreaInsets();
  const { state } = useTrips();
  const plan = state.tripPlans[id];
  const writePlan = usePlanWriter(id);

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(Math.min(Number(dayParam ?? 0) || 0, Math.max(0, (plan?.days.length ?? 1) - 1)));
  const [part, setPart] = useState<DayPart>('afternoon');
  const [minutes, setMinutes] = useState(60);

  if (!plan) return null;
  const multiDay = plan.days.length > 1;

  const add = () => {
    if (!title.trim()) return;
    const stops = plan.days[day].stops;
    // Borrow a location from the stop it sits after, so the map and travel times stay sensible.
    const near = [...stops].reverse().find((s) => RANK[s.place.bestTime] <= RANK[part])?.place ?? stops[0]?.place;
    const place = customPlace({ cityId: id, title, note, bestTime: part, minutes, by: state.myName ?? 'You', near });
    writePlan(addCustomStop(plan, day, place));
    haptic.success();
    router.back();
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text variant="micro">Your own stop</Text>
      <Text variant="display" style={styles.title}>
        Add a stop
      </Text>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Lunch at Ammachi's, pick up Amma…"
        placeholderTextColor={light.inkFaint}
        maxLength={60}
        autoFocus
        style={[styles.input, styles.titleInput]}
        accessibilityLabel="What's the stop"
      />
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="A note for everyone (optional)"
        placeholderTextColor={light.inkFaint}
        maxLength={140}
        multiline
        style={[styles.input, styles.noteInput]}
        accessibilityLabel="Note"
      />

      {multiDay ? (
        <>
          <Text variant="micro" style={styles.label}>
            Which day
          </Text>
          <Chips
            value={day}
            onChange={setDay}
            options={plan.days.map((d, i) => ({ key: i, label: d.date ? formatDay(d.date) : `Day ${i + 1}` }))}
          />
        </>
      ) : null}

      <Text variant="micro" style={styles.label}>
        When
      </Text>
      <Chips value={part} onChange={setPart} options={PARTS} />

      <Text variant="micro" style={styles.label}>
        How long
      </Text>
      <Chips value={minutes} onChange={setMinutes} options={LENGTHS} />

      <Button label="Add to the plan" onPress={add} disabled={!title.trim()} style={styles.cta} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 22, paddingTop: 28 },
  title: { marginTop: 6, marginBottom: 18 },
  input: {
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: light.canvas,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: light.ink,
  },
  titleInput: { height: 54, fontFamily: fonts.sansMedium, fontSize: 17 },
  noteInput: { marginTop: 10, minHeight: 70, paddingTop: 14, textAlignVertical: 'top' },
  label: { marginTop: 22, marginBottom: 10 },
  cta: { marginTop: 28 },
});
