import { StyleSheet, type AccessibilityProps, type StyleProp, type ViewStyle } from 'react-native';
import { ArrowCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowCounterClockwise';
import { ArrowElbowDownRightIcon } from 'phosphor-react-native/src/icons/ArrowElbowDownRight';
import { ArrowRightIcon } from 'phosphor-react-native/src/icons/ArrowRight';
import { ArrowsClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { ArrowUpRightIcon } from 'phosphor-react-native/src/icons/ArrowUpRight';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CarIcon } from 'phosphor-react-native/src/icons/Car';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp';
import { ChatCircleTextIcon } from 'phosphor-react-native/src/icons/ChatCircleText';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CircleIcon } from 'phosphor-react-native/src/icons/Circle';
import { ClipboardTextIcon } from 'phosphor-react-native/src/icons/ClipboardText';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { CloudIcon } from 'phosphor-react-native/src/icons/Cloud';
import { CloudSlashIcon } from 'phosphor-react-native/src/icons/CloudSlash';
import { CoffeeIcon } from 'phosphor-react-native/src/icons/Coffee';
import { CompassIcon } from 'phosphor-react-native/src/icons/Compass';
import { DotsThreeIcon } from 'phosphor-react-native/src/icons/DotsThree';
import { ExportIcon } from 'phosphor-react-native/src/icons/Export';
import { EyeIcon } from 'phosphor-react-native/src/icons/Eye';
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText';
import { FilmStripIcon } from 'phosphor-react-native/src/icons/FilmStrip';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { InstagramLogoIcon } from 'phosphor-react-native/src/icons/InstagramLogo';
import { LinkSimpleIcon } from 'phosphor-react-native/src/icons/LinkSimple';
import { LinkSimpleHorizontalIcon } from 'phosphor-react-native/src/icons/LinkSimpleHorizontal';
import { LockSimpleIcon } from 'phosphor-react-native/src/icons/LockSimple';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { MapTrifoldIcon } from 'phosphor-react-native/src/icons/MapTrifold';
import { MoonIcon } from 'phosphor-react-native/src/icons/Moon';
import { NavigationArrowIcon } from 'phosphor-react-native/src/icons/NavigationArrow';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { PersonSimpleWalkIcon } from 'phosphor-react-native/src/icons/PersonSimpleWalk';
import { PlayIcon } from 'phosphor-react-native/src/icons/Play';
import { PlayCircleIcon } from 'phosphor-react-native/src/icons/PlayCircle';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { PlusCircleIcon } from 'phosphor-react-native/src/icons/PlusCircle';
import { RepeatIcon } from 'phosphor-react-native/src/icons/Repeat';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
import { SlidersHorizontalIcon } from 'phosphor-react-native/src/icons/SlidersHorizontal';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { LockSimpleOpenIcon } from 'phosphor-react-native/src/icons/LockSimpleOpen';
import { TagIcon } from 'phosphor-react-native/src/icons/Tag';
import { TextAlignLeftIcon } from 'phosphor-react-native/src/icons/TextAlignLeft';
import { ThermometerIcon } from 'phosphor-react-native/src/icons/Thermometer';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { UserPlusIcon } from 'phosphor-react-native/src/icons/UserPlus';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { WifiSlashIcon } from 'phosphor-react-native/src/icons/WifiSlash';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { YoutubeLogoIcon } from 'phosphor-react-native/src/icons/YoutubeLogo';

// The app's icons, from Phosphor (MIT): rounded to sit with Plus Jakarta and the mascots, and with
// a filled weight for whatever is chosen (the tab you're on). Each is imported on its own so only
// these few reach the app. The names are the ones the screens already used (Feather's, until
// 29 Oct 2026), so a screen asks for 'map-pin' and gets Phosphor's pin.
const GLYPHS = {
  'alert-circle': WarningCircleIcon,
  'align-left': TextAlignLeftIcon,
  'arrow-right': ArrowRightIcon,
  'arrow-up-right': ArrowUpRightIcon,
  bell: BellIcon,
  'book-open': BookOpenIcon,
  bookmark: BookmarkSimpleIcon,
  calendar: CalendarBlankIcon,
  camera: CameraIcon,
  car: CarIcon,
  check: CheckIcon,
  'check-circle': CheckCircleIcon,
  'chevron-down': CaretDownIcon,
  'chevron-left': CaretLeftIcon,
  'chevron-right': CaretRightIcon,
  'chevron-up': CaretUpIcon,
  circle: CircleIcon,
  clipboard: ClipboardTextIcon,
  clock: ClockIcon,
  cloud: CloudIcon,
  'cloud-off': CloudSlashIcon,
  coffee: CoffeeIcon,
  compass: CompassIcon,
  'corner-down-right': ArrowElbowDownRightIcon,
  'edit-2': PencilSimpleIcon,
  eye: EyeIcon,
  'file-text': FileTextIcon,
  film: FilmStripIcon,
  home: HouseIcon,
  image: ImageIcon,
  info: InfoIcon,
  instagram: InstagramLogoIcon,
  link: LinkSimpleIcon,
  'link-2': LinkSimpleHorizontalIcon,
  lock: LockSimpleIcon,
  'log-out': SignOutIcon,
  map: MapTrifoldIcon,
  'map-pin': MapPinIcon,
  'message-square': ChatCircleTextIcon,
  moon: MoonIcon,
  'more-horizontal': DotsThreeIcon,
  navigation: NavigationArrowIcon,
  play: PlayIcon,
  'play-circle': PlayCircleIcon,
  plus: PlusIcon,
  'plus-circle': PlusCircleIcon,
  'refresh-cw': ArrowsClockwiseIcon,
  repeat: RepeatIcon,
  'rotate-ccw': ArrowCounterClockwiseIcon,
  search: MagnifyingGlassIcon,
  share: ExportIcon,
  shield: ShieldCheckIcon,
  sliders: SlidersHorizontalIcon,
  star: StarIcon,
  sun: SunIcon,
  tag: TagIcon,
  thermometer: ThermometerIcon,
  unlock: LockSimpleOpenIcon,
  user: UserIcon,
  'user-plus': UserPlusIcon,
  walk: PersonSimpleWalkIcon,
  'wifi-off': WifiSlashIcon,
  x: XIcon,
  youtube: YoutubeLogoIcon,
} as const;

export type IconName = keyof typeof GLYPHS;
export const iconNames = Object.keys(GLYPHS) as IconName[];

type Props = AccessibilityProps & {
  name: IconName;
  size?: number;
  color?: string;
  /** Regular everywhere; fill for the chosen one (the tab you're on). */
  weight?: 'regular' | 'bold' | 'fill';
  style?: StyleProp<ViewStyle>;
};

// Phosphor draws its lines at a sixteenth of the icon's size, so small icons (beside 12 and 14pt
// labels) came out hairline next to their words. At 16pt and under they use the bold weight, which
// keeps every icon's line near 1.2–1.5pt whatever its size.
const SMALL = 16;

export function Icon({ name, size = 24, color, weight = 'regular', style, ...a11y }: Props) {
  const Glyph = GLYPHS[name];
  const drawn = weight === 'regular' && size <= SMALL ? 'bold' : weight;
  // On the web the icon is a bare <svg>, which a tight row squeezes like any flex item (a pill's
  // home icon came out 1pt wide). Feather's were text and never shrank; neither do these.
  return <Glyph size={size} color={color} weight={drawn} style={[styles.keep, style]} {...a11y} />;
}

const styles = StyleSheet.create({ keep: { flexShrink: 0 } });
