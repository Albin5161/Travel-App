// The web's copies of the fonts in fontFiles.ts: the same fonts compressed as WOFF2, about a third
// of the size, since the first screen waits for them. Made from the @expo-google-fonts TTFs with
// `fonttools ttLib.woff2 compress`; redo them if those packages change their fonts.
/* eslint-disable @typescript-eslint/no-require-imports -- WOFF2 is an asset type metro.config.js adds, which Expo's lint list doesn't know */

/** Everything the first screen needs. */
export const firstFonts = {
  PlusJakartaSans_500Medium: require('../../assets/fonts/PlusJakartaSans_500Medium.woff2'),
  PlusJakartaSans_600SemiBold: require('../../assets/fonts/PlusJakartaSans_600SemiBold.woff2'),
  PlusJakartaSans_700Bold: require('../../assets/fonts/PlusJakartaSans_700Bold.woff2'),
  PlusJakartaSans_800ExtraBold: require('../../assets/fonts/PlusJakartaSans_800ExtraBold.woff2'),
  Geist_400Regular: require('../../assets/fonts/Geist_400Regular.woff2'),
  Geist_500Medium: require('../../assets/fonts/Geist_500Medium.woff2'),
  Geist_600SemiBold: require('../../assets/fonts/Geist_600SemiBold.woff2'),
};

/** Only the maps' sea names use it, so it loads after the first screen. */
export const laterFonts = {
  PlusJakartaSans_500Medium_Italic: require('../../assets/fonts/PlusJakartaSans_500Medium_Italic.woff2'),
};
