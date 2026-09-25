import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { pickPhoto } from '@/lib/photo';
import { useTrips } from '@/state/trips';
import { fonts, light } from '@/theme/tokens';

/**
 * You, as a circle: your photo, or your initial until you add one. Tapping it picks a new photo;
 * the small camera badge says so.
 */
export function ProfilePhoto({ size = 64, editable = true }: { size?: number; editable?: boolean }) {
  const { state, dispatch } = useTrips();
  const initial = state.myName?.trim()[0]?.toUpperCase();
  const circle = { width: size, height: size, borderRadius: size / 2 };

  const face = state.myPhoto ? (
    <Image source={{ uri: state.myPhoto }} style={[styles.photo, circle]} contentFit="cover" transition={150} />
  ) : (
    <View style={[styles.empty, circle]}>
      {initial ? (
        <Text style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.52 }]}>{initial}</Text>
      ) : (
        <Feather name="user" size={size * 0.42} color={light.inkFaint} />
      )}
    </View>
  );
  if (!editable) return face;

  return (
    <PressableScale
      onPress={async () => {
        const photo = await pickPhoto();
        if (!photo) return;
        haptic.success();
        dispatch({ type: 'setMyPhoto', photo });
      }}
      accessibilityRole="button"
      accessibilityLabel={state.myPhoto ? 'Change your photo' : 'Add your photo'}
    >
      {face}
      <View style={[styles.badge, { right: size * 0.02, bottom: size * 0.02 }]}>
        <Feather name="camera" size={12} color={light.ctaInk} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  photo: { backgroundColor: light.canvasTop },
  empty: { alignItems: 'center', justifyContent: 'center', backgroundColor: light.panel, borderWidth: 1, borderColor: light.line },
  initial: { fontFamily: fonts.display, color: light.ink },
  badge: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.ink,
    borderWidth: 2,
    borderColor: light.canvas,
  },
});
