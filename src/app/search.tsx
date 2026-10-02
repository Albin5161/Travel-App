import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import Ionicons from '@/components/Ionicons';
import { PressableScale } from '@/components/PressableScale';
import { Glass } from '@/components/sky/Glass';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { dims } from '@/components/pressed';
import { getCity } from '@/data/api';
import type { City } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { FADE_IN } from '@/lib/motion';
import { search, type Hit } from '@/lib/search';
import { useSavedSpots, useTrips } from '@/state/trips';
import { skyFill, skyInk } from '@/theme/sky';
import { fonts, radii, space } from '@/theme/tokens';

const KIND: Record<string, string> = { food: 'Food', stay: 'Stay', sight: 'Sight', experience: 'Experience' };
/** Past this many places, the list says how many more rather than growing without end. */
const PLACES_SHOWN = 30;

/**
 * Search what you've saved: cities, places (by name, area, city or kind, so "cafe" finds the food
 * spots) and the creators they came from. Tapping a creator searches for them, which lists every
 * place of theirs you kept.
 */
export default function Search() {
  const insets = useSafeAreaInsets();
  const { state } = useTrips();
  const saved = useSavedSpots();
  const [query, setQuery] = useState('');

  const cities = useMemo(
    () =>
      Object.values(state.collections)
        .sort((a, b) => b.addedAt - a.addedAt)
        .flatMap((c) => {
          const city = getCity(c.cityId);
          return city ? [{ city, places: c.placeIds.filter((id) => !state.skipped[id]).length }] : [];
        }),
    [state.collections, state.skipped],
  );
  const found = useMemo(() => search(query, cities, saved), [query, cities, saved]);
  const typed = query.trim().length > 0;
  const none = typed && found.cities.length + found.places.length + found.creators.length === 0;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openCity = (city: City) => {
    haptic.selection();
    router.push({ pathname: '/city/[id]', params: { id: city.id } });
  };

  return (
    <SkyScreen style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.bar}>
        <IconButton icon="chevron-left" onPress={close} accessibilityLabel="Back" style={styles.back} />
        <Glass style={styles.field} radius={999}>
          <Feather name="search" size={16} color={skyInk.soft} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Places, cities, creators"
            placeholderTextColor={skyInk.faint}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.input}
            accessibilityLabel="Search your saved places, cities and creators"
          />
          {typed ? (
            <Pressable onPress={() => setQuery('')} style={dims(styles.clear)} accessibilityRole="button" accessibilityLabel="Clear search">
              <Feather name="x" size={14} color={skyInk.soft} />
            </Pressable>
          ) : null}
        </Glass>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {!typed ? (
          // Before anything's typed: your cities, one tap away, and what you can search for.
          <Animated.View entering={FADE_IN} style={styles.section}>
            <Text variant="label" color={skyInk.soft}>
              Search everything you’ve saved: a place, an area, a city, a kind (“cafe”), or who posted it.
            </Text>
            {cities.length ? (
              <>
                <Text variant="eyebrow" accessibilityRole="header" style={styles.heading}>
                  Your cities
                </Text>
                {cities.map(({ city, places }) => (
                  <Row key={city.id} photo={city.hero} title={city.name} detail={`${places} ${places === 1 ? 'spot' : 'spots'} · ${city.state}`} onPress={() => openCity(city)} />
                ))}
              </>
            ) : null}
          </Animated.View>
        ) : none ? (
          <Animated.View entering={FADE_IN} style={styles.empty}>
            <Text variant="headline" accessibilityRole="header">
              Nothing saved matches “{query.trim()}”
            </Text>
            <Text variant="body">Seen it in a video? Paste the link on Home and its places land here.</Text>
          </Animated.View>
        ) : (
          <View style={styles.section} accessibilityLiveRegion="polite">
            {found.cities.length ? <Section title="Cities" hits={found.cities} onCity={openCity} onCreator={setQuery} /> : null}
            {found.places.length ? <Section title="Places" hits={found.places.slice(0, PLACES_SHOWN)} onCity={openCity} onCreator={setQuery} /> : null}
            {found.places.length > PLACES_SHOWN ? (
              <Text variant="label" color={skyInk.soft}>
                {found.places.length - PLACES_SHOWN} more. Add a word to narrow it down.
              </Text>
            ) : null}
            {found.creators.length ? <Section title="Creators" hits={found.creators} onCity={openCity} onCreator={setQuery} /> : null}
          </View>
        )}
      </ScrollView>
    </SkyScreen>
  );
}

function Section({
  title,
  hits,
  onCity,
  onCreator,
}: {
  title: string;
  hits: Hit[];
  onCity: (city: City) => void;
  onCreator: (handle: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text variant="eyebrow" accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {hits.map((hit) => {
        if (hit.kind === 'city') {
          return (
            <Row
              key={hit.city.id}
              photo={hit.city.hero}
              title={hit.city.name}
              detail={`${hit.places} ${hit.places === 1 ? 'spot' : 'spots'} · ${hit.city.state}`}
              onPress={() => onCity(hit.city)}
            />
          );
        }
        if (hit.kind === 'place') {
          return (
            <Row
              key={hit.place.id}
              photo={hit.place.photo}
              title={hit.place.name}
              // The area once: "Food · Kochi", not "Food · Kochi · Kochi" when the area is the city.
              detail={[KIND[hit.place.type], hit.place.area || null, hit.city]
                .filter((part, i, all) => !!part && all.findIndex((x) => x?.toLowerCase() === part.toLowerCase()) === i)
                .join(' · ')}
              onPress={() => {
                haptic.selection();
                router.push({ pathname: '/place/[id]', params: { id: hit.place.id } });
              }}
            />
          );
        }
        return (
          <Row
            key={hit.handle}
            icon={hit.platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'}
            title={hit.handle}
            detail={`${hit.places} saved ${hit.places === 1 ? 'place' : 'places'} · tap to see them`}
            onPress={() => {
              haptic.selection();
              onCreator(hit.handle.replace(/^@/, ''));
            }}
          />
        );
      })}
    </View>
  );
}

function Row({
  photo,
  icon,
  title,
  detail,
  onPress,
}: {
  photo?: City['hero'];
  icon?: 'logo-youtube' | 'logo-instagram';
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`}>
      {photo ? (
        <Image source={photo} style={styles.thumb} contentFit="cover" transition={0} />
      ) : (
        <View style={[styles.thumb, styles.thumbIcon]}>
          <Ionicons name={icon ?? 'person'} size={20} color={skyInk.strong} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="label" color={skyInk.soft} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={skyInk.faint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.screen },
  back: { width: 44, height: 44, borderRadius: 22 },
  field: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 4 },
  // 16pt: an iPhone zooms the page into any smaller field.
  input: { flex: 1, height: 48, fontFamily: fonts.sans, fontSize: 16, color: skyInk.strong, outlineStyle: 'none' } as object,
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.screen, paddingTop: 20 },
  section: { gap: 10 },
  group: { gap: 4, marginBottom: 14 },
  heading: { marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  thumb: { width: 48, height: 48, borderRadius: radii.pane, backgroundColor: skyFill.raised },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  empty: { gap: 8, paddingTop: 12 },
});
