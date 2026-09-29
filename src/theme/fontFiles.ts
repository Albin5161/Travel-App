// The font files behind `fonts` in tokens.ts, as the phone apps load them. The web loads smaller
// WOFF2 copies instead (fontFiles.web.ts). Each weight is imported by its own path so the build
// doesn't carry every weight of both families.
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_500Medium_Italic } from '@expo-google-fonts/plus-jakarta-sans/500Medium_Italic';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

/** Everything the first screen needs. */
export const firstFonts = {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
};

/** Only the maps' sea names use it, so it loads after the first screen. */
export const laterFonts = { PlusJakartaSans_500Medium_Italic };
