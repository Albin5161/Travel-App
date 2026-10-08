import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import Ionicons from '@/components/Ionicons';
import { MascotMoment, type Line } from '@/components/mascots/ReadingScene';
import { PressableScale } from '@/components/PressableScale';
import { Glass } from '@/components/sky/Glass';
import { GlassSheet } from '@/components/sky/GlassSheet';
import { Text } from '@/components/Text';
import { dims } from '@/components/pressed';
import { detectPlatform } from '@/data/api';
import { haptic } from '@/lib/haptics';
import { fadeUp, REFLOW } from '@/lib/motion';
import { parseLink } from '@/server/links';
import { useIntroOver } from '@/state/inbox';
import { useTrips, type InboxItem } from '@/state/trips';
import { skyCta, skyFill, skyInk, skyOnCta } from '@/theme/sky';
import { radii, space } from '@/theme/tokens';

const ENTER = fadeUp(80);
/** How many place names the sheet lists before "and 4 more". */
const NAMES_SHOWN = 4;

const places = (n: number) => `${n} ${n === 1 ? 'place' : 'places'}`;
const kindOf = (url: string) => (detectPlatform(url) === 'youtube' ? 'YouTube video' : 'Instagram reel');

/** Opens a read link's places to be checked: right, wrong, or missed. Nothing is saved before that. */
function useCheck() {
  const { dispatch } = useTrips();
  return (item: InboxItem) => {
    if (!item.extraction) return;
    haptic.light();
    dispatch({ type: 'stageExtraction', extraction: item.extraction });
    router.push('/verify');
  };
}

/**
 * Links being read without a screen of their own, on Home: those shared into the app, and those
 * pasted several at once. One row each, saying where it has got to; a read one opens to be checked.
 */
export function LinkInbox() {
  const { state, dispatch } = useTrips();
  const check = useCheck();
  const items = state.inbox;
  if (items.length === 0) return null;

  const queued = items.filter((i) => i.status === 'queued');
  const done = items.length - queued.length;
  const heading =
    queued.length > 0
      ? items.length === 1
        ? 'Reading your link'
        : `Reading your links, ${done} of ${items.length} done`
      : items.some((i) => i.status === 'ready')
        ? 'Read, and waiting for you to check'
        : 'We couldn’t read these';

  const open = (item: InboxItem) => {
    if (item.status === 'ready') return check(item);
    if (item.status === 'queued') return;
    haptic.light();
    // Worth another go: back in the line. Otherwise it opens on its own screen, which says what
    // went wrong and offers adding the places by hand.
    if (item.retryable) return dispatch({ type: 'inboxRetry', key: item.key });
    dispatch({ type: 'inboxRemove', key: item.key });
    dispatch({ type: 'setPendingLink', url: item.url });
    router.push('/analysing');
  };

  return (
    <Animated.View entering={ENTER} layout={REFLOW}>
      <Glass style={styles.card}>
        <Text variant="label" color={skyInk.soft} accessibilityRole="header" style={styles.heading}>
          {heading}
        </Text>
        {items.map((item) => (
          <Row
            key={item.key}
            item={item}
            active={item === queued[0]}
            onOpen={() => open(item)}
            onRemove={() => {
              haptic.selection();
              dispatch({ type: 'inboxRemove', key: item.key });
            }}
          />
        ))}
      </Glass>
    </Animated.View>
  );
}

function Row({ item, active, onOpen, onRemove }: { item: InboxItem; active: boolean; onOpen: () => void; onRemove: () => void }) {
  const e = item.extraction;
  const kind = kindOf(item.url);
  const title = item.status === 'ready' && e ? e.city.name : kind;
  const line =
    item.status === 'ready' && e
      ? [places(e.places.length), e.reel.creator].filter(Boolean).join(' · ')
      : item.status === 'failed'
        ? (item.problem ?? 'We couldn’t read this one.')
        : active
          ? 'Reading it now. You can keep going.'
          : 'Next in line';
  const action = item.status === 'ready' ? 'Check' : item.status === 'failed' ? (item.retryable ? 'Try again' : 'Open') : null;

  return (
    <View style={styles.row}>
      <PressableScale
        onPress={onOpen}
        disabled={item.status === 'queued'}
        containerStyle={styles.grow}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${line}${action ? `. ${action}` : ''}`}
      >
        <Thumb item={item} busy={active} />
        <View style={styles.text}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="label" color={skyInk.soft} numberOfLines={item.status === 'failed' ? 2 : 1}>
            {line}
          </Text>
        </View>
        {action ? (
          <View style={[styles.action, item.status === 'ready' && styles.actionMain]}>
            <Text variant="label" color={item.status === 'ready' ? skyOnCta : undefined}>
              {action}
            </Text>
          </View>
        ) : null}
      </PressableScale>
      <Pressable
        onPress={onRemove}
        style={dims(styles.remove)}
        accessibilityRole="button"
        accessibilityLabel={item.status === 'queued' ? `Stop reading this ${kind}` : `Remove ${title}`}
      >
        <Feather name="x" size={14} color={skyInk.faint} />
      </Pressable>
    </View>
  );
}

/** The city's photo once it's read; until then the video's own picture, or its platform's mark. */
function Thumb({ item, busy }: { item: InboxItem; busy: boolean }) {
  const link = parseLink(item.url);
  const early: ImageSourcePropType | null =
    link?.platform === 'youtube' ? { uri: `https://i.ytimg.com/vi/${link.videoId}/mqdefault.jpg` } : null;
  const photo = item.extraction?.city.hero ?? item.extraction?.reel.thumbnail ?? early;
  return (
    <View style={styles.thumb}>
      {photo ? (
        <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      ) : (
        <Ionicons name={detectPlatform(item.url) === 'youtube' ? 'logo-youtube' : 'logo-instagram'} size={20} color={skyInk.soft} />
      )}
      {busy ? <Breathing /> : null}
    </View>
  );
}

/** A slow wash over the picture of the link being read: something is happening, without a spinner. */
function Breathing() {
  const reduced = useReducedMotion();
  const on = useSharedValue(0.15);
  useEffect(() => {
    if (reduced) return;
    on.set(withRepeat(withTiming(0.5, { duration: 900 }), -1, true));
  }, [on, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: on.get() }));
  return <Animated.View style={[StyleSheet.absoluteFill, styles.wash, style]} pointerEvents="none" />;
}

/**
 * "Here's what we found": said once for links that were read while nobody was watching (shared in
 * from another app, or left reading on an earlier visit). It names what each link turned into and
 * asks for the check; closing it leaves them waiting on Home.
 */
export function FoundSheet() {
  const { state, dispatch } = useTrips();
  const { width: W } = useWindowDimensions();
  const check = useCheck();
  const introOver = useIntroOver();
  const [onHome, setOnHome] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setOnHome(true);
      return () => setOnHome(false);
    }, []),
  );

  const fresh = state.inbox.filter((i) => i.status === 'ready' && !i.told && i.extraction);
  const visible = introOver && onHome && state.onboarded && fresh.length > 0;
  const close = () => dispatch({ type: 'inboxTold' });
  const open = (item: InboxItem) => {
    close();
    check(item);
  };

  const one = fresh.length === 1 ? fresh[0] : null;
  const first = fresh[0]?.extraction;
  const total = fresh.reduce((n, i) => n + (i.extraction?.places.length ?? 0), 0);
  const lines: Line[] = one
    ? [
        { who: 'kid', text: `Amma, it’s ${first?.city.name}!` },
        { who: 'amma', text: 'Let’s see what they found.' },
      ]
    : [
        { who: 'kid', text: 'Amma, they’re all read!' },
        { who: 'amma', text: 'Let’s go through them.' },
      ];

  return (
    <GlassSheet visible={visible} onClose={close}>
      {first ? (
        <View style={styles.sheet}>
          <View style={styles.scene}>
            <MascotMoment lines={lines} width={Math.min(W - space.screen * 2 - 28, 300)} about="Amma and the child look at what the links turned into." />
          </View>
          <Text variant="headline" accessibilityRole="header">
            {one ? `${places(first.places.length)} in ${first.city.name}` : `${fresh.length} links read, ${places(total)} found`}
          </Text>
          <Text variant="body">
            {one
              ? `From the ${kindOf(one.url)} you ${one.from === 'share' ? 'shared' : 'added'}${first.reel.creator ? `, by ${first.reel.creator}` : ''}. Have a look and keep the ones we got right.`
              : 'Have a look at each and keep the places we got right. Nothing is saved until you do.'}
          </Text>

          {one ? (
            <View style={styles.names}>
              {first.places.slice(0, NAMES_SHOWN).map((p) => (
                <View key={p.id} style={styles.nameRow}>
                  <Feather name="map-pin" size={13} color={skyInk.soft} />
                  <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
                    {p.name}
                  </Text>
                  {p.area ? (
                    <Text variant="label" color={skyInk.soft} numberOfLines={1} style={styles.area}>
                      {p.area}
                    </Text>
                  ) : null}
                </View>
              ))}
              {first.places.length > NAMES_SHOWN ? (
                <Text variant="label" color={skyInk.soft}>{`and ${first.places.length - NAMES_SHOWN} more`}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.names}>
              {fresh.map((item) => (
                <PressableScale
                  key={item.key}
                  onPress={() => open(item)}
                  style={styles.found}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.extraction!.city.name}, ${places(item.extraction!.places.length)}. Check them.`}
                >
                  <Thumb item={item} busy={false} />
                  <View style={styles.text}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {item.extraction!.city.name}
                    </Text>
                    <Text variant="label" color={skyInk.soft} numberOfLines={1}>
                      {[places(item.extraction!.places.length), item.extraction!.reel.creator].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={skyInk.soft} />
                </PressableScale>
              ))}
            </View>
          )}

          <Button
            trailingArrow
            label={one ? (first.places.length === 1 ? 'Check this place' : `Check ${first.places.length} places`) : `Start with ${first.city.name}`}
            onPress={() => open(fresh[0])}
            style={styles.go}
          />
          <Button kind="text" label="Later" onPress={close} accessibilityHint="They stay on Home until you check them" />
        </View>
      ) : null}
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 4, marginBottom: 10, paddingTop: 12, paddingBottom: 4 },
  heading: { paddingHorizontal: 14, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingVertical: 8, minHeight: 64 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radii.thumb,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skyFill.pane,
  },
  wash: { backgroundColor: '#FFFFFF' },
  text: { flex: 1, gap: 1 },
  // A 32pt pill inside the row's 64pt tap.
  action: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
    backgroundColor: skyFill.raised,
  },
  actionMain: { backgroundColor: skyCta, borderColor: skyInk.rim },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  sheet: { gap: 10 },
  scene: { alignItems: 'center', overflow: 'hidden', borderRadius: radii.pane, backgroundColor: skyFill.pane, paddingTop: 10 },
  names: { gap: 8, marginTop: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1 },
  area: { flexShrink: 2 },
  found: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    paddingRight: 12,
    borderRadius: radii.pane,
    backgroundColor: skyFill.pane,
  },
  go: { marginTop: 8 },
});
