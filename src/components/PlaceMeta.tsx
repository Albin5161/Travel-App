import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { getReel } from '@/data/api';
import type { Place } from '@/data/types';
import { formatDuration } from '@/lib/geo';
import { colors } from '@/theme/tokens';

import { GlassPill } from './GlassPill';
import { Text } from './Text';

const PART_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' } as const;
const TYPE_LABEL = { food: 'Food', stay: 'Stay', sight: 'Sight', experience: 'Experience' } as const;

export const costLabel = (c: Place['cost']) => (c === 0 ? 'Free' : '₹'.repeat(c));

export function typeLine(p: Place) {
  return `${TYPE_LABEL[p.type]} · ${p.area}`;
}

export function MetaPills({ place, onPhoto }: { place: Place; onPhoto?: boolean }) {
  return (
    <View style={styles.pills}>
      <GlassPill onPhoto={onPhoto} label={PART_LABEL[place.bestTime]} />
      <GlassPill onPhoto={onPhoto} label={costLabel(place.cost)} />
      <GlassPill onPhoto={onPhoto} label={`~${formatDuration(place.minutes)}`} />
    </View>
  );
}

export function SourceLine({ place }: { place: Place }) {
  if (place.source.kind === 'local') {
    return (
      <Text variant="micro" color={colors.ember}>
        Recommended by locals
      </Text>
    );
  }
  if (place.source.kind === 'custom') {
    return <Text variant="data">Added by {place.source.by}</Text>;
  }
  const reel = getReel(place.source.reelId);
  if (!reel) return null;
  return (
    <View style={styles.source}>
      <Ionicons name={reel.platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'} size={14} color={colors.ash} />
      <Text variant="data">
        From {reel.creator} · {place.source.timestamp} in the {reel.platform === 'youtube' ? 'video' : 'reel'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
