import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';

import { Ticket } from '@/components/home/Ticket';
import { Text } from '@/components/Text';
import { getCity, getReel, isSampleLink } from '@/data/api';
import { haptic } from '@/lib/haptics';
import { fadeUp } from '@/lib/motion';
import { useTrips, type Draft } from '@/state/trips';
import { light } from '@/theme/tokens';

const ENTER = fadeUp(80);

/** What the draft is waiting on, in words: where the person left off. */
function stepLine(d: Draft, places: number): string {
  switch (d.stage) {
    case 'reading':
      return 'Still reading it';
    case 'checking':
      return places ? `${places} places found. Check them next.` : 'Places found. Check them next.';
    case 'questions':
      return 'A few questions left';
    case 'plan':
      return 'Your plan is ready to save';
  }
}

/** The same, as the tail of a sentence that starts with the place's name. */
function quietStep(d: Draft): string {
  switch (d.stage) {
    case 'reading':
      return 'is still being read';
    case 'checking':
      return 'has places to check';
    case 'questions':
      return 'has a few questions left';
    case 'plan':
      return 'has a plan ready to save';
  }
}

/** Planning that was left part-way: what to call it, its picture, and the tap that carries on from that step. */
export function useDraft() {
  const { state, dispatch } = useTrips();
  const d = state.draft;
  if (!d) return null;

  const extraction = d.stage === 'checking' ? d.extraction : null;
  const city = extraction?.city ?? ('cityId' in d && d.cityId ? getCity(d.cityId) : null);
  const reel = extraction?.reel ?? (d.stage === 'checking' && d.reelId ? getReel(d.reelId) : null);

  const resume = () => {
    haptic.light();
    switch (d.stage) {
      case 'reading':
        dispatch({ type: 'setPendingLink', url: d.url });
        router.push('/analysing');
        return;
      case 'checking':
        // A real link's places were kept; a sample reads again, instantly, from its link.
        if (d.extraction && !isSampleLink(d.url)) {
          dispatch({ type: 'stageExtraction', extraction: d.extraction });
          router.push('/verify');
        } else {
          dispatch({ type: 'setPendingLink', url: d.url });
          router.push('/analysing');
        }
        return;
      case 'questions':
        router.push({ pathname: '/trip/[id]', params: { id: d.cityId } });
        return;
      case 'plan':
        router.push({ pathname: '/plan/[id]', params: { id: d.cityId } });
    }
  };

  return {
    name: city?.name ?? 'Your video',
    named: !!city,
    photo: city?.hero ?? reel?.thumbnail ?? null,
    step: stepLine(d, extraction?.places.length ?? 0),
    quiet: quietStep(d),
    resume,
    stop: () => {
      haptic.selection();
      dispatch({ type: 'setDraft', draft: null });
    },
  };
}

/**
 * Planning that was left part-way, offered back at the top of Home as a ticket: where it's for,
 * where it stopped, and one tap to carry on from that step. The x stops it for good.
 */
export function ContinueCard() {
  const draft = useDraft();
  if (!draft) return null;
  const { name, named, photo, step } = draft;

  return (
    <Animated.View entering={ENTER}>
      <Ticket
        photo={photo}
        onPress={draft.resume}
        accessibilityLabel={`Carry on with ${named ? name : 'your video'}. ${step}`}
        onDismiss={draft.stop}
        dismissLabel={`Stop planning ${named ? name : 'your video'}`}
        stub={<Feather name="arrow-right" size={20} color={light.ink} />}
      >
        <Text variant="title" numberOfLines={1}>
          {name}
        </Text>
        {/* Where it was left, in words. No bar and no percentage: this is a trip, not a download. */}
        <Text variant="label" color={light.inkSoft} numberOfLines={2}>
          {step}
        </Text>
      </Ticket>
    </Animated.View>
  );
}
