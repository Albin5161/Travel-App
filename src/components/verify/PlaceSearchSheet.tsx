import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { typeLine } from '@/components/PlaceMeta';
import { Text } from '@/components/Text';
import type { Place } from '@/data/types';
import { ApiFailure } from '@/lib/api';
import { newSearchSession, searchPlaces, type Suggestion } from '@/lib/extract';
import type { LatLng } from '@/lib/geo';
import { fonts, light } from '@/theme/tokens';

type Props = {
  visible: boolean;
  /** Fixing a wrong card shows its name and offers "It wasn't a place"; adding shows neither. */
  wrong?: Place | null;
  cityName: string;
  /** Places this search can find, for the sample videos. */
  candidates: Place[];
  /**
   * For a real link: search Google instead, leaning toward `near`, and turn a picked result into a
   * place with `resolve` (null when Google can't place it).
   */
  live?: { near: LatLng | null; resolve: (s: Suggestion, session: string) => Promise<Place | null> };
  onPick: (place: Place) => void;
  onNotAPlace?: () => void;
  onClose: () => void;
};

/**
 * Where a wrong answer gets put right, or a missed place gets added. A native page sheet on iOS
 * (drag to dismiss), with a search that starts populated: an empty field would ask the user to
 * remember a name the video only said once.
 */
export function PlaceSearchSheet({ visible, wrong, cityName, candidates, live, onPick, onNotAPlace, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = live
    ? []
    : candidates.filter((p) => !q || p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q));
  const google = useGoogleSearch(live ? query : '', live?.near ?? null);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const close = () => {
    setQuery('');
    setPickError(null);
    google.reset();
    onClose();
  };

  const pick = async (s: Suggestion) => {
    if (!live || picking) return;
    setPicking(s.placeId);
    setPickError(null);
    try {
      const place = await live.resolve(s, google.session);
      if (place) {
        setQuery('');
        google.reset();
        onPick(place);
      } else {
        setPickError(`Google couldn’t put ${s.name} on a map. Try another result.`);
      }
    } catch (e) {
      setPickError(e instanceof ApiFailure ? e.message : 'Something went wrong. Try again.');
    } finally {
      setPicking(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.head}>
          <View style={styles.titles}>
            <Text variant="micro">{wrong ? `Instead of ${wrong.name}` : `Add to ${cityName}`}</Text>
            <Text variant="headline">{wrong ? 'What was it?' : 'Missed one?'}</Text>
          </View>
          <IconButton icon="x" onPress={close} accessibilityLabel="Close" />
        </View>

        <View style={styles.field}>
          <Feather name="search" size={16} color={light.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={live ? 'Search for a place' : `Search places in ${cityName}`}
            placeholderTextColor={light.inkFaint}
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            selectionColor={light.ink}
            style={[styles.input, NO_FOCUS_RING]}
            accessibilityLabel="Search for the right place"
          />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
          {live ? (
            <GoogleResults
              query={query}
              state={google}
              picking={picking}
              error={pickError}
              onPick={pick}
            />
          ) : matches.length === 0 ? (
            <Text variant="body" style={styles.none}>
              {q
                ? `Nothing called “${query.trim()}” in ${cityName} yet. Try part of the name, or the area it's in.`
                : `We don't know any other places in ${cityName} yet.`}
            </Text>
          ) : (
            matches.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  setQuery('');
                  onPick(p);
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, ${p.area}`}
              >
                <Image source={p.photo} style={styles.thumb} contentFit="cover" transition={0} />
                <View style={styles.rowText}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="label" color={light.inkSoft} numberOfLines={1}>
                    {typeLine(p)}
                  </Text>
                </View>
                <Feather name="plus" size={18} color={light.inkSoft} />
              </Pressable>
            ))
          )}
        </ScrollView>

        {wrong && onNotAPlace ? (
          <Pressable
            onPress={() => {
              setQuery('');
              onNotAPlace();
            }}
            style={styles.notPlace}
            accessibilityRole="button"
          >
            <Text variant="label" color={light.inkSoft}>
              It wasn&apos;t a place. Just leave it out.
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

/** Wait this long after the last keystroke before searching: one request per pause, not per letter. */
const PAUSE_MS = 350;
const MIN_LETTERS = 3;

type GoogleState = {
  session: string;
  results: Suggestion[];
  loading: boolean;
  error: string | null;
  reset: () => void;
};

/**
 * Google's suggestions for what's typed, once there are three letters and a pause. One session id
 * from the first search to the pick, so the typing is billed as one search; each query is asked
 * once per session, so deleting and retyping costs nothing.
 */
function useGoogleSearch(query: string, near: LatLng | null): GoogleState {
  const [session, setSession] = useState(newSearchSession);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(new Map<string, Suggestion[]>());
  const text = query.trim();

  useEffect(() => {
    if (text.length < MIN_LETTERS) return;
    const known = asked.current.get(text.toLowerCase());
    let stale = false;
    const t = setTimeout(
      () => {
        if (known) {
          setResults(known);
          return;
        }
        setLoading(true);
        setError(null);
        searchPlaces(text, session, near)
          .then((r) => {
            asked.current.set(text.toLowerCase(), r);
            if (!stale) setResults(r);
          })
          .catch((e: unknown) => {
            if (!stale) setError(e instanceof ApiFailure ? e.message : 'Search isn’t working right now. Try again.');
          })
          .finally(() => !stale && setLoading(false));
      },
      known ? 0 : PAUSE_MS,
    );
    return () => {
      stale = true;
      clearTimeout(t);
    };
    // `near` is read when a search starts; moving it shouldn't search again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, session]);

  return {
    session,
    results: text.length < MIN_LETTERS ? [] : results,
    loading,
    error,
    reset: () => {
      asked.current.clear();
      setResults([]);
      setError(null);
      setSession(newSearchSession());
    },
  };
}

function GoogleResults({
  query,
  state,
  picking,
  error,
  onPick,
}: {
  query: string;
  state: GoogleState;
  picking: string | null;
  error: string | null;
  onPick: (s: Suggestion) => void;
}) {
  const typed = query.trim();
  const message =
    error ??
    state.error ??
    (typed.length < MIN_LETTERS
      ? 'Type the name you saw or heard, and the town if you know it.'
      : !state.loading && state.results.length === 0
        ? `Nothing found for “${typed}”. Try fewer words, or add the town.`
        : null);
  return (
    <>
      {message ? (
        <Text variant="body" style={styles.none}>
          {message}
        </Text>
      ) : null}
      {state.results.map((s) => (
        <Pressable
          key={s.placeId}
          onPress={() => onPick(s)}
          disabled={!!picking}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${s.name}, ${s.where}`}
        >
          <View style={[styles.thumb, styles.pinThumb]}>
            <Feather name="map-pin" size={18} color={light.inkSoft} />
          </View>
          <View style={styles.rowText}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {s.name}
            </Text>
            <Text variant="label" color={light.inkSoft} numberOfLines={1}>
              {s.where}
            </Text>
          </View>
          {picking === s.placeId ? (
            <ActivityIndicator color={light.inkSoft} />
          ) : (
            <Feather name="plus" size={18} color={light.inkSoft} />
          )}
        </Pressable>
      ))}
      {state.results.length > 0 ? (
        <Text variant="micro" style={styles.powered}>
          Results from Google
        </Text>
      ) : null}
    </>
  );
}

// Same as the link box: on web the browser's own focus ring would draw inside the field.
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: light.panel, paddingHorizontal: 20, paddingTop: 20 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titles: { gap: 4, flexShrink: 1 },
  field: {
    marginTop: 18,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: light.canvas,
    borderWidth: 1,
    borderColor: light.line,
  },
  input: { flex: 1, height: '100%', fontFamily: fonts.sans, fontSize: 15, color: light.ink },
  list: { paddingVertical: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 14 },
  rowPressed: { backgroundColor: light.canvas },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: light.canvasTop },
  pinThumb: { alignItems: 'center', justifyContent: 'center' },
  powered: { paddingHorizontal: 6, paddingTop: 10 },
  rowText: { flex: 1, gap: 2 },
  none: { paddingHorizontal: 6, paddingTop: 8 },
  notPlace: { alignSelf: 'center', paddingVertical: 12 },
});
