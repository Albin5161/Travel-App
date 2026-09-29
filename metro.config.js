// Expo's Metro setup, plus WOFF2 as an asset type: the web build loads its fonts as WOFF2
// (src/theme/fontFiles.web.ts).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('woff2');

module.exports = config;
