import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { typeLine } from '@/components/PlaceMeta';
import { Text } from '@/components/Text';
import type { Place } from '@/data/types';
import { fonts, light } from '@/theme/tokens';

type Props = {
  visible: boolean;
  /** Fixing a wrong card shows its name and offers "It wasn't a place"; adding shows neither. */
  wrong?: Place | null;
  cityName: string;
  /** Places this search can find. Canned for the demo; a place search API replaces it. */
  candidates: Place[];
  onPick: (place: Place) => void;
  onNotAPlace?: () => void;
  onClose: () => void;
};

/**
 * Where a wrong answer gets put right, or a missed place gets added. A native page sheet on iOS
 * (drag to dismiss), with a search that starts populated: an empty field would ask the user to
 * remember a name the video only said once.
 */
export function PlaceSearchSheet({ visible, wrong, cityName, candidates, onPick, onNotAPlace, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = candidates.filter((p) => !q || p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q));

  const close = () => {
    setQuery('');
    onClose();
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
            placeholder={`Search places in ${cityName}`}
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
          {matches.length === 0 ? (
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
  rowText: { flex: 1, gap: 2 },
  none: { paddingHorizontal: 6, paddingTop: 8 },
  notPlace: { alignSelf: 'center', paddingVertical: 12 },
});
