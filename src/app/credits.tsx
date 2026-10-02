import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { dims } from '@/components/pressed';
import { CHANGES, CREDITS, FROM_VIDEOS, STAND_INS, UNSPLASH } from '@/data/credits';
import { skyFill, skyInk } from '@/theme/sky';
import { space } from '@/theme/tokens';

const open = (url: string) => Linking.openURL(url).catch(() => {});

/**
 * Who took the photos, under what licence, and which Kottayam photos are stand-ins. Reached from
 * Profile. Plain on purpose: a list people can check, not a screen to admire.
 */
export default function Credits() {
  const insets = useSafeAreaInsets();
  return (
    <SkyScreen style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <IconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Back" />
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}>
        <Text variant="display" accessibilityRole="header">
          Photo credits
        </Text>
        <Text variant="body" style={styles.lead}>
          The photos in this prototype come from Wikimedia Commons and Unsplash. {CHANGES}
        </Text>

        <Text variant="eyebrow" accessibilityRole="header" style={styles.section}>
          Wikimedia Commons
        </Text>
        {CREDITS.map((c) => (
          <View key={c.sourceUrl} style={styles.row}>
            <Image source={c.photo} style={styles.thumb} contentFit="cover" transition={0} />
            <View style={styles.rowText}>
              <Text variant="bodyStrong">{c.title}</Text>
              <Text variant="label" color={skyInk.soft}>
                by {c.author} ·{' '}
                <Text variant="label" style={styles.link} onPress={() => open(c.licenseUrl)}>
                  {c.license}
                </Text>
              </Text>
              {c.standIn ? (
                <Text variant="label" color={skyInk.faint}>
                  {c.standIn}
                </Text>
              ) : null}
              <Pressable onPress={() => open(c.sourceUrl)} hitSlop={6} accessibilityRole="link" style={dims(styles.source)}>
                <Text variant="label" style={styles.link}>
                  View on Wikimedia Commons
                </Text>
                <Feather name="arrow-up-right" size={12} color={skyInk.strong} />
              </Pressable>
            </View>
          </View>
        ))}

        <Text variant="eyebrow" accessibilityRole="header" style={styles.section}>
          Unsplash
        </Text>
        <Text variant="body">
          {UNSPLASH.note}{' '}
          <Text variant="body" style={styles.link} onPress={() => open(UNSPLASH.url)}>
            Unsplash License
          </Text>
        </Text>
        <Text variant="body">{FROM_VIDEOS}</Text>

        <Text variant="eyebrow" accessibilityRole="header" style={styles.section}>
          Stand-in photos
        </Text>
        <Text variant="body" style={styles.standLead}>
          The Kottayam spots are real places we haven&apos;t photographed yet. Until then they borrow:
        </Text>
        {STAND_INS.map((s) => (
          <Text key={s.spot} variant="label" color={skyInk.soft} style={styles.stand}>
            <Text variant="label">{s.spot}</Text> uses {s.using}
          </Text>
        ))}
      </ScrollView>
    </SkyScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.screen },
  body: { paddingHorizontal: space.screen, paddingTop: 20 },
  lead: { marginTop: 10 },
  section: { marginTop: 30, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: skyFill.pane },
  rowText: { flex: 1, gap: 3 },
  link: { color: skyInk.strong, textDecorationLine: 'underline' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, alignSelf: 'flex-start' },
  standLead: { marginBottom: 10 },
  stand: { marginBottom: 6 },
});
