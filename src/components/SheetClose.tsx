import { router } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { space } from '@/theme/tokens';

/** Room to leave at the top of a sheet's content on the web, so the ✕ doesn't cover it. */
export const SHEET_CLOSE_ROOM = Platform.OS === 'web' ? 56 : 0;

/**
 * The way out of a screen the phone apps show as a pull-down sheet (a place, Add a stop, Vote). On
 * the web those open full screen with no handle to pull, so they get a ✕ in the corner instead;
 * phones keep the handle and draw nothing here.
 */
export function SheetClose() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'web') return null;
  return (
    <IconButton
      icon="x"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      accessibilityLabel="Close"
      style={[styles.close, { top: insets.top + 12 }]}
    />
  );
}

const styles = StyleSheet.create({
  close: { position: 'absolute', right: space.screen, zIndex: 10 },
});
