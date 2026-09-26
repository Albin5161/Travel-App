import { router, type Href } from 'expo-router';
import { Fragment } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import type { LegalDoc } from '@/data/legal';
import { light } from '@/theme/tokens';

/**
 * The privacy policy or the terms. Plain, like the photo credits: something to read and check, not a
 * screen to admire. Also the public web pages testers and app stores are pointed at.
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const insets = useSafeAreaInsets();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={[styles.fill, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-left" onPress={back} accessibilityLabel="Back" />
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}>
        <Text variant="display" accessibilityRole="header">
          {doc.title}
        </Text>
        <Text variant="label" color={light.inkFaint} style={styles.updated}>
          Last updated {doc.updated}
        </Text>
        {doc.intro.map((p) => (
          <Text key={p} variant="body" style={styles.para}>
            <Linked text={p} />
          </Text>
        ))}
        {doc.sections.map((s) => (
          <View key={s.heading}>
            <Text variant="bodyStrong" accessibilityRole="header" style={styles.heading}>
              {s.heading}
            </Text>
            {s.blocks.map((b, i) =>
              typeof b === 'string' ? (
                <Text key={i} variant="body" style={styles.para}>
                  <Linked text={b} />
                </Text>
              ) : (
                <View key={i} style={styles.list}>
                  {b.list.map((item) => (
                    <View key={item} style={styles.item}>
                      <Text variant="body">•</Text>
                      <Text variant="body" style={styles.itemText}>
                        <Linked text={item} />
                      </Text>
                    </View>
                  ))}
                </View>
              ),
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Text with [label](url) links: in-app paths open the screen, anything else opens outside. */
function Linked({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        const [, label, url] = m;
        const open = () => (url.startsWith('/') ? router.push(url as Href) : void Linking.openURL(url).catch(() => {}));
        return (
          <Text key={i} variant="body" style={styles.link} onPress={open} accessibilityRole="link">
            {label}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  header: { paddingHorizontal: 16 },
  body: { paddingHorizontal: 24, paddingTop: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  updated: { marginTop: 6, marginBottom: 8 },
  heading: { marginTop: 26, marginBottom: 2 },
  para: { marginTop: 8 },
  list: { marginTop: 8, gap: 8 },
  item: { flexDirection: 'row', gap: 8 },
  itemText: { flex: 1 },
  link: { color: light.ink, textDecorationLine: 'underline' },
});
