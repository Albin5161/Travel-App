import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  label?: string;
  /** Dark glass over photography, light glass over dark UI. */
  onPhoto?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function GlassPill({ label, onPhoto, icon, style, children }: Props) {
  return (
    <View style={[styles.pill, style]}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: onPhoto ? colors.glassDark : colors.glassLight }]} />
      <View style={styles.row}>
        {icon}
        {label ? <Text variant="label">{label}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.rim,
    alignSelf: 'flex-start',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
});
