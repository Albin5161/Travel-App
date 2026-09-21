import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useId, useState, type ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';

import { colors, radii } from '@/theme/tokens';

// Gradient only under text: clean photo until ~40pt above the text, then down to solid Night.
const GRADIENTS = {
  city: {
    colors: ['rgba(13,15,14,0)', 'rgba(13,15,14,0.5)', 'rgba(13,15,14,1)'] as const,
    locations: [0.64, 0.73, 1] as const,
  },
  pick: {
    colors: ['rgba(13,15,14,0)', 'rgba(13,15,14,0.6)', 'rgba(13,15,14,0.92)', 'rgba(13,15,14,1)'] as const,
    locations: [0.4, 0.52, 0.7, 1] as const,
  },
  none: null,
};

type Props = {
  source: ImageSourcePropType;
  gradient?: keyof typeof GRADIENTS;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function PhotoCard({ source, gradient = 'city', radius = radii.card, style, children }: Props) {
  const g = GRADIENTS[gradient];
  return (
    <View style={[styles.card, { borderRadius: radius }, style]}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      {g ? (
        <LinearGradient colors={g.colors} locations={g.locations} style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}
      {children}
      <GlassRim radius={radius} />
    </View>
  );
}

// Thin lit edge, light from the top-left (315°), fading out toward the bottom-right.
export function GlassRim({ radius }: { radius: number }) {
  const id = useId().replace(/:/g, '');
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
              <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0.14} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.04} />
            </SvgGradient>
          </Defs>
          <Rect
            x={0.75}
            y={0.75}
            width={size.w - 1.5}
            height={size.h - 1.5}
            rx={radius - 0.75}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={1.5}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.basalt },
});
