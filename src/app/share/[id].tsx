import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CARD_RATIO, ShareCard, ShareStory } from '@/components/share/ShareCard';
import { PatternBackdrop } from '@/components/share/PatternBackdrop';
import { TiltCard } from '@/components/share/TiltCard';
import { usePlanPdf } from '@/components/share/usePlanPdf';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { getCity } from '@/data/api';
import { PARTY_COPY, swapCandidates } from '@/data/group';
import { partyOf } from '@/data/planner';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { FADE_IN, fadeUp } from '@/lib/motion';
import { createTrip } from '@/lib/live/api';
import { ensureUser, liveEnabled } from '@/lib/live/client';
import type { CardData } from '@/lib/cardImage';
import { planMessage, saveImage, sharePlanCard, webImageFile, type ImageKind } from '@/lib/share';
import { lookFor } from '@/lib/patterns';
import { startGroup } from '@/state/group';
import { useHomeSky } from '@/state/sky';
import { useTrips } from '@/state/trips';
import { SKY, skyFill, skyInk } from '@/theme/sky';
import { fonts, space } from '@/theme/tokens';

const HEAD_IN = fadeUp(0);
const TITLE_IN = fadeUp(60);

// After the passport stamp: the plan, as a card you can tilt, ready to send to whoever's going.
// Sharing starts their vote. Arrived at by replacing the plan screen, so there's no back; "Done"
// goes to the Trips tab, where the trip now lives.
export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const city = getCity(id);
  const { state, dispatch } = useTrips();
  const plan = state.tripPlans[id];
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Flat copies, off screen, for the pictures: the tilting card on screen isn't what's saved.
  const card = useRef<View>(null);
  const story = useRef<View>(null);
  const look = SKY[useHomeSky()];
  const backdrop = lookFor(city?.state ?? '');
  const [issued] = useState(() => new Date());
  // Stable while nothing about the card changes, so the pictures are drawn once.
  const cardData = useMemo<CardData | null>(() => (city && plan ? { city, plan, issued, look } : null), [city, plan, issued, look]);
  const images = useReadyImages(cardData, `xplore-${id}`);
  const [saving, setSaving] = useState<ImageKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [name, setName] = useState(state.myName ?? '');
  // The room between the headline and the buttons, measured: a phone browser's own bars leave far
  // less than the window height suggests, so the card is fitted to this, not guessed.
  const [stageH, setStageH] = useState<number | null>(null);

  // Nothing to share without a plan (a reload wipes the in-memory store): go home.
  useEffect(() => {
    if (!plan) router.dismissTo('/');
  }, [plan]);

  const pdf = usePlanPdf(city, plan);
  if (!city || !plan) return null;
  const stops = plan.days.reduce((sum, d) => sum + d.stops.length, 0);
  const party = partyOf(plan.prefs);
  const copy = PARTY_COPY[party];
  // With the backend set up, sharing makes a real trip others can join. The first time, it needs a
  // name, so the people you send it to know who's asking.
  const live = liveEnabled && party !== 'solo';
  const needName = live && !state.myName;

  // The card is laid out at its natural size (so the shared image is always full size) and scaled
  // down as a whole when the stage is shorter than that.
  const cardW = Math.min(W - 64, 340);
  const cardH = Math.round(cardW * CARD_RATIO);
  const fit = stageH ? Math.min(1, (stageH - 20) / cardH) : 1;

  const savePdf = async () => {
    const result = await pdf.save();
    if (result === 'failed') setNote('Couldn’t make the PDF. Try again?');
    else if (result === 'downloaded') setNote('PDF saved to your downloads.');
    else if (result === 'shared') setNote('PDF ready. Keep it for the trip.');
  };

  const save = async (kind: ImageKind) => {
    if (saving) return;
    haptic.light();
    setSaving(kind);
    try {
      const result = await saveImage(
        kind === 'card' ? card : story,
        kind,
        `xplore-${city.id}${kind === 'story' ? '-story' : ''}`,
        { city, plan, issued, look },
        images[kind],
      );
      if (result === 'dismissed') return;
      haptic.success();
      track('plan image saved', { kind, how: result });
      setNote(result === 'downloaded' ? 'Saved to your downloads.' : kind === 'story' ? 'Story ready. Post it anywhere.' : 'Card ready. Post it anywhere.');
    } catch {
      setNote('Couldn’t make the picture. Try again?');
    } finally {
      setSaving(null);
    }
  };

  const share = async () => {
    if (busy) return;
    if (needName && !name.trim()) return;
    setBusy(true);
    try {
      let code: string | undefined;
      if (live) {
        const me = name.trim() || state.myName!;
        if (needName) dispatch({ type: 'setMyName', name: me });
        const existing = state.remote[id];
        if (existing) code = existing.code;
        else {
          const swapFor = swapCandidates(plan);
          const row = await createTrip({ plan, party, swapFor, name: me });
          const user = await ensureUser();
          dispatch({ type: 'setRemote', cityId: id, remote: { tripId: row.id, code: row.code, me: user, owner: row.owner, ownerName: me } });
          startGroup(dispatch, plan, true, swapFor);
          code = row.code;
        }
      }
      const result = await sharePlanCard(card, planMessage(city.name, city.id, stops, plan.days.length, party, code), images.card);
      if (result === 'dismissed') return;
      if (result === 'shared') haptic.success();
      else haptic.light();
      setSent(true);
      track('plan shared', { party, live, how: result });
      // The vote starts the moment it's out: people begin joining while you're still in the chat.
      if (!live) startGroup(dispatch, plan);
      const chat = party === 'family' ? 'family chat' : party === 'partner' ? 'chat' : 'group';
      setNote(
        (result === 'copied' ? `Message copied. Paste it in your ${chat}.` : party === 'solo' ? 'Sent.' : 'Sent. Now get everyone to agree.') +
          (code ? ` Join code ${code}.` : ''),
      );
    } catch {
      setNote(live ? 'Couldn’t reach Xplore’s server. Check your connection and try again.' : 'Couldn’t open sharing. Try again?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SkyScreen style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 12 }}>
      {/* The state's own cloth, as the saved story prints it: what's on screen is what gets posted. */}
      <PatternBackdrop look={backdrop} ground calm={{ top: backdrop.ground, height: insets.top + 150 }} />
      <View style={styles.head}>
        <Animated.View entering={HEAD_IN}>
          <Text variant="eyebrow">
            {city.name} · {plan.days.length === 1 ? 'day planned' : `${plan.days.length} days planned`}
          </Text>
        </Animated.View>
        <Animated.View entering={TITLE_IN}>
          <Text variant="display" accessibilityRole="header" style={styles.title}>
            {'Your Xplore plan\nis ready'}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.stage} onLayout={(e) => setStageH(e.nativeEvent.layout.height)}>
        {stageH ? (
          <View style={{ transform: [{ scale: fit }] }}>
            <TiltCard width={cardW} height={cardH} delay={160}>
              <ShareCard city={city} plan={plan} width={cardW} issued={issued} />
            </TiltCard>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {note ? (
          <Animated.View entering={FADE_IN}>
            <Text variant="label" color={skyInk.soft} style={styles.note}>
              {note}
            </Text>
          </Animated.View>
        ) : null}
        {needName && !sent ? (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name, so they know who's asking"
            placeholderTextColor={skyInk.faint}
            style={styles.name}
            autoCapitalize="words"
            returnKeyType="done"
            maxLength={40}
            accessibilityLabel="Your name"
          />
        ) : null}
        {sent && party !== 'solo' ? (
          <Button trailingArrow label={copy.see} onPress={() => router.push({ pathname: '/group/[id]', params: { id } })} />
        ) : sent ? (
          <Button label="Done" onPress={() => router.dismissTo('/trips')} />
        ) : (
          <Button trailingArrow={!busy} label={busy ? 'Getting it ready…' : copy.share} onPress={share} disabled={busy || (needName && !name.trim())} />
        )}
        {/* Pictures to post: the card as a post, and as a story. */}
        <View style={styles.saves}>
          <Button
            kind="secondary"
            compact
            label={saving === 'card' ? 'Making…' : pdf.available ? 'Image' : 'Save image'}
            onPress={() => save('card')}
            style={styles.save}
            accessibilityHint="Saves the card as a picture you can post"
          />
          <Button
            kind="secondary"
            compact
            label={saving === 'story' ? 'Making…' : pdf.available ? 'Story' : 'Story size'}
            onPress={() => save('story')}
            style={styles.save}
            accessibilityHint="Saves a tall version for Instagram or WhatsApp stories"
          />
          {pdf.available ? (
            <Button
              kind="secondary"
              compact
              label={pdf.making ? 'Making…' : 'PDF'}
              onPress={savePdf}
              style={styles.save}
              accessibilityHint="Saves the plan as a PDF: every day, to print or keep for the trip"
            />
          ) : null}
        </View>
        {sent && party === 'solo' ? null : (
          <Button kind="text" label={sent ? 'Done' : 'Done for now'} onPress={() => router.dismissTo('/trips')} />
        )}
      </View>

      {/* Phone apps picture these: off screen, drawn flat at their saved sizes. The web draws its
          pictures on a canvas instead, so it doesn't lay them out at all. */}
      {Platform.OS === 'web' ? null : (
        <View style={styles.offscreen} pointerEvents="none" aria-hidden>
          <View ref={card} collapsable={false}>
            <ShareCard city={city} plan={plan} width={360} issued={issued} square />
          </View>
          <View ref={story} collapsable={false}>
            <ShareStory city={city} plan={plan} issued={issued} look={look} />
          </View>
        </View>
      )}
    </SkyScreen>
  );
}

/**
 * On the web, both pictures made a moment after the screen settles, so a tap on Save or Share
 * hands them over at once (an iPhone opens the share sheet only straight after a tap). Phones make
 * them on the tap, where there's no such limit.
 */
function useReadyImages(data: CardData | null, name: string) {
  const [files, setFiles] = useState<Record<ImageKind, File | null>>({ card: null, story: null });
  // A moment after the card has come in: drawing them is quick, but not worth a dropped frame.
  useEffect(() => {
    if (Platform.OS !== 'web' || !data) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const card = await webImageFile('card', data, name);
        if (alive) setFiles((f) => ({ ...f, card }));
        const story = await webImageFile('story', data, `${name}-story`);
        if (alive) setFiles((f) => ({ ...f, story }));
      } catch {
        // Made on the tap instead.
      }
    }, 900);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [data, name]);
  return files;
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.screen },
  title: { marginTop: 8 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: space.screen, gap: 4 },
  note: { textAlign: 'center', marginBottom: 8 },
  saves: { flexDirection: 'row', gap: 10, marginTop: 10 },
  save: { flex: 1 },
  // Far off to the left: laid out and drawn (so it can be pictured), never seen.
  offscreen: { position: 'absolute', left: -10000, top: 0, gap: 20 },
  name: {
    height: 52,
    marginBottom: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: skyFill.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: skyInk.strong,
  },
});
