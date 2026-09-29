import createIconSet from '@expo/vector-icons/createIconSet';

// The only Ionicons the app draws. The full font is 390 KB and Home's city cards show the logos,
// so the web would fetch all of it for two tiny glyphs; this is the same font cut down to these
// four (assets/fonts/IoniconsFew.ttf, 1.5 KB, made with fonttools' pyftsubset). To add one, look up
// its code in @expo/vector-icons' glyphmaps/Ionicons.json and subset the font again with it.
const GLYPHS = {
  'logo-instagram': 0xf3f9,
  'logo-youtube': 0xf42c,
  person: 0xf4a5,
  play: 0xf4c6,
};

const Ionicons = createIconSet(GLYPHS, 'ionicons-few', require('../../assets/fonts/IoniconsFew.ttf'));

export default Ionicons;
