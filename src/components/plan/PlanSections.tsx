import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Button } from '@/components/Button';
import { typeLine } from '@/components/PlaceMeta';
import { PressableScale } from '@/components/PressableScale';
import { SafetyScale } from '@/components/plan/SafetyScale';
import { isSafetyIcon, SafetyIcon } from '@/components/SafetyIcon';
import { Text } from '@/components/Text';
import { formatCount, formatRupees, getPlaceRating, type CityInfo } from '@/data/cityInfo';
import type { DayPlan } from '@/data/plan';
import type { DayPart, Place } from '@/data/types';
import { formatClock } from '@/lib/geo';
import type { CityNotes } from '@/server/types';
import { light } from '@/theme/tokens';

type SectionProps = { onLayout: (e: LayoutChangeEvent) => void };

function Section({
  title,
  meta,
  onLayout,
  children,
}: SectionProps & { title: string; meta?: string; children: ReactNode }) {
  return (
    <View style={styles.section} onLayout={onLayout}>
      <View style={styles.sectionHead}>
        <Text variant="headline">{title}</Text>
        {meta ? <Text variant="micro">{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

type LiveNotes = { notes?: CityNotes | null; loading?: boolean };

export function OverviewSection({
  cityName,
  info,
  notes,
  loading,
  onLayout,
}: SectionProps & { cityName: string; info?: CityInfo } & LiveNotes) {
  // A city from a pasted link has no hand-written notes: it gets what Wikipedia and Wikivoyage say,
  // and where they say nothing, the page says so rather than guess.
  if (!info) {
    if (!notes) {
      return <NoNotes title={`About ${cityName}`} cityName={cityName} loading={loading} onLayout={onLayout} />;
    }
    return (
      <Section title={`About ${cityName}`} onLayout={onLayout}>
        {notes.summary ? <Text variant="body">{notes.summary}</Text> : null}
        {notes.bestTime || notes.idealStay ? (
          <View style={styles.stats}>
            {notes.bestTime ? <Stat label="Best time" value={notes.bestTime} /> : null}
            {notes.idealStay ? <Stat label="Ideal stay" value={notes.idealStay} /> : null}
          </View>
        ) : null}
        {notes.tips.length ? (
          <>
            <Text variant="micro" style={styles.group}>
              Good to know before you go
            </Text>
            <Tips items={notes.tips} />
          </>
        ) : null}
        <Sources notes={notes} />
      </Section>
    );
  }
  const max = Math.max(...info.costBreakdown.map((c) => c.amount));
  return (
    <Section title={`About ${cityName}`} onLayout={onLayout}>
      <Text variant="body">{info.summary}</Text>
      <View style={styles.stats}>
        <Stat label="Best time" value={info.bestTime} />
        <Stat label="Ideal stay" value={info.idealStay} />
        <Stat label="Per day" value={`${formatRupees(info.costPerDay.low)}+`} />
      </View>

      <Text variant="bodyStrong" style={styles.subhead}>
        Cost per day
      </Text>
      <Text variant="data">
        {formatRupees(info.costPerDay.low)} – {formatRupees(info.costPerDay.high)} a person, mid-range
      </Text>
      <View style={styles.bars}>
        {info.costBreakdown.map((c) => (
          <View key={c.label} style={styles.barRow}>
            <View style={styles.barLabels}>
              <Text variant="label" color={light.inkSoft}>
                {c.label}
              </Text>
              <Text variant="data" color={light.ink}>
                {formatRupees(c.amount)}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((c.amount / max) * 100)}%` }]} />
            </View>
          </View>
        ))}
      </View>
      <Note>Our estimate from local prices.</Note>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="micro" numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

export function PlacesSection({ places, cityId, onLayout }: SectionProps & { places: Place[]; cityId: string }) {
  return (
    <Section title="Your places" meta={`${places.length} saved`} onLayout={onLayout}>
      <Button
        kind="secondary"
        compact
        label="Open the map"
        onPress={() => router.push({ pathname: '/citymap/[id]', params: { id: cityId } })}
        style={styles.mapButton}
      />
      <View style={styles.places}>
        {places.map((p) => (
          <PlaceRow key={p.id} place={p} />
        ))}
      </View>
      {places.some((p) => getPlaceRating(p.id)) ? <Note>Ratings and reviews from Google. Sample data for the demo.</Note> : null}
    </Section>
  );
}

function PlaceRow({ place }: { place: Place }) {
  const rating = getPlaceRating(place.id);
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${place.name}${rating ? `, rated ${rating.score}` : ''}`}
      style={styles.placeRow}
    >
      <Image source={place.photo} style={styles.thumb} contentFit="cover" transition={0} />
      <View style={styles.placeText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {place.name}
        </Text>
        <Text variant="data" numberOfLines={1}>
          {typeLine(place)}
        </Text>
        {rating ? (
          <>
            <View style={styles.ratingRow}>
              <Text variant="label" color={light.accent}>
                ★ {rating.score.toFixed(1)}
              </Text>
              <Text variant="data">· {formatCount(rating.count)} reviews</Text>
            </View>
            <Text variant="body" numberOfLines={2} style={styles.review}>
              “{rating.review.text}”
            </Text>
            <Text variant="data" color={light.inkFaint}>
              {rating.review.author} · {rating.review.when}
            </Text>
          </>
        ) : null}
      </View>
    </PressableScale>
  );
}

const PART_TITLE: Record<DayPart, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

export function PlanSection({ plan, planned, onLayout }: SectionProps & { plan: DayPlan; planned: boolean }) {
  return (
    <Section
      title="Your day"
      meta={`${plan.stops.length} ${plan.stops.length === 1 ? 'stop' : 'stops'} · ${plan.totalKm.toFixed(1)} km`}
      onLayout={onLayout}
    >
      <Text variant="body">
        {planned
          ? 'Saved. Here’s how your day runs.'
          : 'Everything you keep goes into one day, each place at its best time. Swipe through them to choose.'}
      </Text>
      <View style={styles.parts}>
        {plan.parts.map((part) => (
          <View key={part.part} style={styles.part}>
            <View style={styles.partText}>
              <Text variant="bodyStrong">{PART_TITLE[part.part]}</Text>
              <Text variant="data">
                {formatClock(part.stops[0].startMinutes)} · {part.stops.length}{' '}
                {part.stops.length === 1 ? 'stop' : 'stops'}
              </Text>
            </View>
            <View style={styles.stack}>
              {part.stops.slice(0, 3).map((s, i) => (
                <Image
                  key={s.place.id}
                  source={s.place.photo}
                  style={[styles.stackThumb, { marginLeft: i === 0 ? 0 : -12, zIndex: 3 - i }]}
                  contentFit="cover"
                  transition={0}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
}

function NoNotes({
  title,
  cityName,
  loading,
  onLayout,
}: SectionProps & { title: string; cityName: string; loading?: boolean }) {
  return (
    <Section title={title} onLayout={onLayout}>
      <Text variant="body">
        {loading
          ? `Reading up on ${cityName}…`
          : `We don’t have notes on ${cityName} yet. Your places and your plan work all the same.`}
      </Text>
    </Section>
  );
}

function Tips({ items }: { items: string[] }) {
  return (
    <View style={styles.tips}>
      {items.map((t) => (
        <View key={t} style={styles.tip}>
          <View style={styles.dot} />
          <Text variant="body" style={styles.tipText}>
            {t}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Wikipedia and Wikivoyage ask for credit, a link, the licence, and a note that it was changed. */
function Sources({ notes }: { notes: CityNotes }) {
  const open = (url: string) => void Linking.openURL(url).catch(() => {});
  return (
    <Text variant="data" color={light.inkFaint} style={styles.note}>
      Summarised from{' '}
      {notes.sources.map((src, i) => (
        <Text key={src.url} variant="data" color={light.inkFaint}>
          {i > 0 ? ' and ' : ''}
          <Text variant="data" style={styles.sourceLink} onPress={() => open(src.url)}>
            {src.site}
          </Text>
        </Text>
      ))}
      ,{' '}
      <Text variant="data" style={styles.sourceLink} onPress={() => open('https://creativecommons.org/licenses/by-sa/4.0/')}>
        CC BY-SA 4.0
      </Text>
      .
    </Text>
  );
}

export function GoodToKnowSection({
  cityName,
  info,
  play,
  onLayout,
  notes,
  loading,
}: SectionProps & { cityName: string; info?: CityInfo; play: boolean } & LiveNotes) {
  // No safety score for a city from a pasted link: nothing reliable backs one. Only the safety
  // points its sources actually make.
  if (!info) {
    if (!notes?.safety.length) {
      return (
        <Section title="Good to know" onLayout={onLayout}>
          <Text variant="body">
            {loading
              ? `Reading up on ${cityName}…`
              : `We don’t have safety notes for ${cityName}. Check local advice before you go.`}
          </Text>
        </Section>
      );
    }
    return (
      <Section title="Good to know" onLayout={onLayout}>
        <Text variant="micro" style={styles.group}>
          Staying safe
        </Text>
        <Tips items={notes.safety} />
        <Sources notes={notes} />
      </Section>
    );
  }
  return (
    <Section title="Good to know" onLayout={onLayout}>
      <Text variant="micro" style={styles.group}>
        Safety today
      </Text>
      <SafetyScale cityName={cityName} score={info.safetyScore.score} signals={info.safetyScore.signals} play={play} />

      <Text variant="micro" style={[styles.group, styles.groupGap]}>
        Staying safe
      </Text>
      <View style={styles.facts}>
        {info.safety.map((f) => (
          <View key={f.title} style={styles.fact}>
            <View style={styles.factIcon}>
              {isSafetyIcon(f.icon) ? (
                <SafetyIcon name={f.icon} size={20} color={light.ink} />
              ) : (
                <Feather name={f.icon} size={16} color={light.ink} />
              )}
            </View>
            <View style={styles.factText}>
              <Text variant="bodyStrong">{f.title}</Text>
              <Text variant="body">{f.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text variant="micro" style={styles.group}>
        From locals
      </Text>
      <View style={styles.tips}>
        {info.localTips.map((t) => (
          <View key={t} style={styles.tip}>
            <View style={styles.dot} />
            <Text variant="body" style={styles.tipText}>
              {t}
            </Text>
          </View>
        ))}
      </View>
      <Note>Sample data for the demo.</Note>
    </Section>
  );
}

function Note({ children }: { children: string }) {
  return (
    <Text variant="data" color={light.inkFaint} style={styles.note}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8, backgroundColor: light.panel },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  subhead: { marginTop: 24 },
  sourceLink: { color: light.inkSoft, textDecorationLine: 'underline' },
  note: { marginTop: 14 },

  stats: { flexDirection: 'row', gap: 8, marginTop: 18 },
  stat: { flex: 1, gap: 4, padding: 12, borderRadius: 16, backgroundColor: light.canvas },
  statLabel: { fontSize: 10, letterSpacing: 0.6 },

  bars: { marginTop: 14, gap: 12 },
  barRow: { gap: 6 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, backgroundColor: light.canvasTop, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: light.ink },

  mapButton: { marginTop: 4, marginBottom: 6 },
  places: { gap: 4 },
  placeRow: { flexDirection: 'row', gap: 14, paddingVertical: 12 },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: light.canvasTop },
  placeText: { flex: 1, gap: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  review: { marginTop: 4 },

  parts: { marginTop: 16, gap: 10 },
  part: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    backgroundColor: light.canvas,
  },
  partText: { gap: 2 },
  stack: { flexDirection: 'row' },
  stackThumb: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: light.canvas },

  group: { marginTop: 8, marginBottom: 12 },
  groupGap: { marginTop: 28 },
  facts: { gap: 16, marginBottom: 20 },
  fact: { flexDirection: 'row', gap: 12 },
  factIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.canvas,
  },
  factText: { flex: 1, gap: 2 },
  tips: { gap: 10 },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: light.accent, marginTop: 9 },
  tipText: { flex: 1 },
});
