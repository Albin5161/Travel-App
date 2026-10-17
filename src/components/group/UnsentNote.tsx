import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Glass } from '@/components/sky/Glass';
import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { useUnsent } from '@/state/live';
import { skyInk } from '@/theme/sky';

/**
 * On a shared trip, when your votes or plan edits couldn't be saved for the others: says so, says
 * they're safe on this phone, and offers to try now. It keeps trying by itself too (state/live), so
 * this is gone again the moment they get through. Nothing shows while all is well.
 */
export function UnsentNote({ cityId }: { cityId: string }) {
  const { count, retry } = useUnsent(cityId);
  const [trying, setTrying] = useState(false);
  if (!count) return null;
  return (
    <Glass style={styles.note}>
      <Feather name="wifi-off" size={18} color={skyInk.soft} />
      <View style={styles.words}>
        <Text variant="label">{count === 1 ? '1 change not sent yet' : `${count} changes not sent yet`}</Text>
        <Text variant="label" ink="soft" tabular>Saved on this phone. The others see them once you’re back online.</Text>
      </View>
      <Button
        kind="text"
        label={trying ? 'Trying…' : 'Try now'}
        disabled={trying}
        onPress={() => {
          haptic.light();
          setTrying(true);
          void retry().finally(() => setTrying(false));
        }}
      />
    </Glass>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 8, marginBottom: 16 },
  words: { flex: 1, gap: 2 },
});
