import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS !== 'web';

export const haptic = {
  light: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  /** A firm tap, for something landing (the passport stamp). */
  thud: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  selection: () => {
    if (enabled) Haptics.selectionAsync();
  },
  success: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  error: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
};
