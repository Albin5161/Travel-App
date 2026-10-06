import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Glass } from '@/components/sky/Glass';
import { Text } from '@/components/Text';
import { dims } from '@/components/pressed';
import { getCity, getReel, isSampleLink } from '@/data/api';
import { haptic } from '@/lib/haptics';
import { fadeUp } from '@/lib/motion';
import { useTrips, type Draft } from '@/state/trips';
import { skyFill, skyInk } from '@/theme/sky';
import { radii } from '@/theme/tokens';

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

/**
 * Planning that was left part-way, offered back at the top of Home: where it stopped, how far it
 * got, and one tap to carry on from that step. The x stops it for good.
 */
export function ContinueCard() {
  const { state, dispatch } = useTrips();
  const d = state.draft;
  if (!d) return null;

  const extraction = d.stage === 'checking' ? d.extraction : null;
  const city = extraction?.city ?? ('cityId' in d && d.cityId ? getCity(d.cityId) : null);
  const reel = extraction?.reel ?? (d.stage === 'checking' && d.reelId ? getReel(d.reelId) : null);
  const name = city?.name ?? 'your video';
  const photo = city?.hero ?? reel?.thumbnail ?? null;

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

  return (
    <Animated.View entering={ENTER}>
      <Glass style={styles.card}>
        <PressableScale
          onPress={resume}
          style={styles.main}
          accessibilityRole="button"
          accessibilityLabel={`Carry on with ${name}. ${stepLine(d, extraction?.places.length ?? 0)}`}
        >
          {photo ? (
            <Image source={photo} style={styles.thumb} contentFit="cover" transition={0} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Feather name="film" size={18} color={skyInk.soft} />
            </View>
          )}
          <View style={styles.text}>
            {/* Where it was left, in words. No bar and no percentage: this is a trip, not a download. */}
            <Text variant="title" numberOfLines={1}>
              {city ? `Carry on with ${name}` : 'Carry on with your video'}
            </Text>
            <Text variant="label" color={skyInk.soft} numberOfLines={1}>
              {stepLine(d, extraction?.places.length ?? 0)}
            </Text>
          </View>
          <Feather name="arrow-right" size={18} color={skyInk.soft} />
        </PressableScale>
        <Pressable
          onPress={() => {
            haptic.selection();
            dispatch({ type: 'setDraft', draft: null });
          }}
          style={dims(styles.stop)}
          accessibilityRole="button"
          accessibilityLabel={`Stop planning ${name}`}
        >
          <Feather name="x" size={14} color={skyInk.faint} />
        </Pressable>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 4 },
  // Right padding keeps the text clear of the stop button in the corner.
  main: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingRight: 44 },
  thumb: { width: 64, height: 64, borderRadius: radii.pane, backgroundColor: skyFill.pane },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  // Top-right, out of the way of the card's own tap: 44pt, as every tap target.
  stop: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
