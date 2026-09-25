import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ProfilePhoto } from '@/components/ProfilePhoto';
import { Text } from '@/components/Text';
import { useTrips } from '@/state/trips';
import { fonts, light, shadows } from '@/theme/tokens';

const PHOTO = 96;
const RING = PHOTO + 26;

/**
 * You, and what a friend sees from you: the photo circle with a slow orbit around it, over the
 * invite a friend would get, which fills in with your name as you type it.
 */
export function ProfilePreview({ active, name }: { active: boolean; name: string }) {
  const reduced = useReducedMotion();
  const { state } = useTrips();
  const shown = name.trim();
  const initial = shown[0]?.toUpperCase();

  return (
    <View style={styles.wrap}>
      <View style={styles.photoWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            reduced
              ? null
              : {
                  animationName: { from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } },
                  animationDuration: '18s',
                  animationTimingFunction: 'linear',
                  animationIterationCount: 'infinite',
                  animationPlayState: active ? 'running' : 'paused',
                },
          ]}
        >
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={RING / 2 - 1.5}
              stroke={light.accent}
              strokeWidth={1.5}
              strokeDasharray={[1, 8]}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
          <View style={styles.orbiter} />
        </Animated.View>
        <ProfilePhoto size={PHOTO} />
      </View>

      <View style={styles.invite} accessibilityLabel={`What friends see: ${shown || 'your name'} invited you to plan Gokarna`}>
        <View style={styles.face}>
          {state.myPhoto ? (
            <Image source={{ uri: state.myPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <Text style={styles.initial}>{initial ?? '?'}</Text>
          )}
        </View>
        <Text variant="label" color={light.inkSoft} numberOfLines={1} style={styles.inviteText}>
          <Text variant="label" style={styles.inviteName} color={shown ? light.ink : light.inkFaint}>
            {shown || 'Your name'}
          </Text>
          {' invited you to plan Gokarna'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 22 },
  photoWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: RING, height: RING },
  orbiter: {
    position: 'absolute',
    top: -3,
    left: RING / 2 - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: light.accent,
    borderWidth: 1.5,
    borderColor: light.canvas,
  },
  invite: {
    maxWidth: 300,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 5,
    paddingRight: 14,
    height: 38,
    borderRadius: 999,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.button,
  },
  face: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.canvasTop,
  },
  initial: { fontFamily: fonts.displayBold, fontSize: 13, lineHeight: 17, color: light.ink },
  inviteText: { flexShrink: 1 },
  inviteName: { fontFamily: fonts.sansSemi },
});
