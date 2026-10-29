import { Icon, type IconName } from '@/components/Icon';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Children, isValidElement, useState, type ReactNode } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/PressableScale';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { Glass } from '@/components/sky/Glass';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { ErrorNote } from '@/components/ErrorNote';
import { Text } from '@/components/Text';
import { allDistricts } from '@/data/regions';
import { Segmented } from '@/components/Segmented';
import { haptic } from '@/lib/haptics';
import { nameProblem } from '@/lib/names';
import { signOut, useAccount } from '@/lib/live/account';
import { liveEnabled } from '@/lib/live/client';
import { MODE, SKY_AVAILABLE, isLight, setMode } from '@/theme/mode';
import { fadeUp, REFLOW } from '@/lib/motion';
import { useArrivalWatch, type Permissions } from '@/state/arrival';
import { useSavedSpots, useTrips } from '@/state/trips';
import { skyChip, skyOnInk, skyFill, skyInk } from '@/theme/sky';
import { fonts, fontSize, radii, shadows, space, textSize } from '@/theme/tokens';


const ENTER = [0, 1, 2, 3, 4, 5].map((i) => fadeUp(60 + i * 50));
const GUTTER = space.screen;

// Background geofencing is not in Expo Go, so "Try it" is the only way to see an arrival there.
// Detected rather than assumed, so a development build drops the caveat.
const inExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

/**
 * Settings, laid out the way iOS does it: grouped lists under small headings, one row per thing,
 * and the same three trailing controls everywhere. A switch turns something on or off, a quiet
 * outlined pill asks for something (Allow), and a chevron goes somewhere. Nothing here uses the
 * black primary button: it's saved for the one main action on a screen, and Profile has none.
 */
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const { permissions, ask, watching, simulate, targets } = useArrivalWatch();
  const spots = useSavedSpots();
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState(state.myName ?? '');
  const [lookNote, setLookNote] = useState<string | null>(null);
  // The name is required, so clearing the field puts the saved one back rather than removing it.
  // One with numbers or symbols isn't saved, and says why in red under the section (lib/names).
  const [nameError, setNameError] = useState<string | null>(null);
  const saveName = () => {
    if (!name.trim()) {
      setName(state.myName ?? '');
      setNameError(null);
      return;
    }
    const problem = nameProblem(name);
    setNameError(problem);
    if (problem) haptic.error();
    else dispatch({ type: 'setMyName', name });
  };

  const home = allDistricts.find((d) => d.id === state.homeDistrictId);
  const trips = Object.values(state.savedTrips).filter(Boolean).length;
  const been = spots.filter((s) => state.spotStatus[s.id] === 'been').length;
  const away = targets.filter((t) => t.districtId !== state.homeDistrictId);
  const allowed = permissions.notifications === 'granted' && permissions.background === 'granted';

  const arrivalDetail = !state.notifyOnArrival
    ? 'Off'
    : watching > 0
      ? `Watching ${watching} ${watching === 1 ? 'district' : 'districts'}`
      : allowed
        ? 'Save a spot outside home to start'
        : 'Needs the two permissions below';

  return (
    <SkyScreen>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 110 }}
    >
      <Animated.View entering={ENTER[0]} style={styles.header}>
        <ProfilePhoto size={72} />
        <View style={styles.headerText}>
          <Text variant="display" accessibilityRole="header" numberOfLines={1}>
            {state.myName ?? 'Profile'}
          </Text>
          <Text variant="label" ink="soft" tabular>{home ? `Home in ${home.name}` : 'No home district yet'}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={ENTER[1]} style={styles.stats}>
        <Stat value={spots.length} label="Spots" onPress={() => router.navigate('/map')} />
        <Stat value={trips} label="Trips" onPress={() => router.navigate('/trips')} />
        <Stat value={been} label="Been" onPress={() => router.navigate('/map')} />
      </Animated.View>

      <Animated.View entering={ENTER[2]}>
        <Section
          title="You"
          footer={nameError ?? 'Friends see your name and photo on trips you share. Your weekend outings, and which places count as away, follow from home.'}
          footerError={!!nameError}
        >
          <Row icon="user" label="Name">
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                setNameError(null);
              }}
              onEndEditing={saveName}
              onBlur={saveName}
              placeholder="Add your name"
              placeholderTextColor={skyInk.faint}
              autoCapitalize="words"
              maxLength={40}
              returnKeyType="done"
              style={styles.nameField}
              accessibilityLabel="Your name"
            />
          </Row>
          <Row
            icon="home"
            label="Home district"
            value={home?.name ?? 'Choose'}
            onPress={() => {
              haptic.selection();
              setPicking((p) => !p);
            }}
            chevron={picking ? 'chevron-up' : 'chevron-down'}
          />
          {picking
            ? allDistricts.map((d) => (
                <Animated.View key={d.id} layout={REFLOW}>
                  <Choice
                    label={d.name}
                    detail={d.state}
                    on={d.id === state.homeDistrictId}
                    onPress={() => {
                      haptic.selection();
                      dispatch({ type: 'setHomeDistrict', districtId: d.id });
                      setPicking(false);
                    }}
                  />
                </Animated.View>
              ))
            : null}
        </Section>
      </Animated.View>

      <Animated.View entering={ENTER[3]}>
        <BackupSection />
      </Animated.View>

      <Animated.View entering={ENTER[3]}>
        <Section
          title="Notifications"
          footer={
            inExpoGo
              ? 'One alert when you reach a district you have spots in, never one per café. Real alerts need a development build; use Try it below to see one here.'
              : 'One alert when you reach a district you have spots in, never one per café.'
          }
        >
          <Row icon="bell" label="Arrival alerts" detail={arrivalDetail}>
            <Switch
              value={state.notifyOnArrival}
              onValueChange={(on) => {
                haptic.selection();
                dispatch({ type: 'setNotifyOnArrival', on });
              }}
              // On is the strong ink (black on paper), as every chosen thing is. On the sky that would be
              // white, and iOS 26 draws the knob white whatever thumbColor says, so it would vanish:
              // there the track is the 60% white outline instead, still clearly lighter than off.
              trackColor={{ true: isLight ? skyInk.strong : skyInk.outline, false: skyFill.pressed }}
              thumbColor={state.notifyOnArrival ? skyOnInk : '#FFFFFF'}
              // Web draws its own green thumb when on unless told otherwise.
              {...({ activeThumbColor: skyOnInk } as object)}
              ios_backgroundColor={skyFill.pressed}
              accessibilityLabel="Arrival alerts"
            />
          </Row>
          <PermissionRow
            name="notifications"
            icon="message-square"
            label="Notifications"
            why="For your lock screen"
            permissions={permissions}
            ask={ask}
            dimmed={!state.notifyOnArrival}
          />
          <PermissionRow
            name="background"
            icon="navigation"
            label="Location, always"
            why="So an arrival reaches you with the app closed"
            permissions={permissions}
            ask={ask}
            dimmed={!state.notifyOnArrival}
          />
        </Section>
      </Animated.View>

      <Animated.View entering={ENTER[4]}>
        <Section
          title="Try it"
          footer={
            away.length
              ? 'Plays exactly what a real arrival would: the alert, then the map on that district.'
              : spots.length === 0
                ? 'Save a spot in Kerala, away from home, to try this.'
                : `Alerts cover Kerala’s districts for now, and none of your spots is in one${home ? ` away from ${home.name}` : ''}.`
          }
        >
          {away.map((t) => (
            <Row
              key={t.districtId}
              icon="map-pin"
              label={`Arrive in ${t.name}`}
              value={`${t.spots} ${t.spots === 1 ? 'spot' : 'spots'}`}
              onPress={() => {
                haptic.success();
                simulate(t.districtId);
              }}
            />
          ))}
        </Section>
      </Animated.View>

      <Animated.View entering={ENTER[5]}>
        <Section title="About" footer="Everything you save is kept on this phone, or in this browser, and backed up to your account while you’re signed in.">
          {/* Only while the Sky look is on offer (theme/mode). */}
          {SKY_AVAILABLE ? (
            <Row icon={MODE === 'light' ? 'sun' : 'moon'} label="Look" detail={lookNote ?? undefined}>
              <View style={styles.look}>
                <Segmented
                  value={MODE}
                  onChange={(next) => {
                    if (next === MODE) return;
                    haptic.selection();
                    // The app starts again in the new look.
                    void setMode(next).then((ok) => {
                      if (!ok) setLookNote('Saved. Close Xplore and open it again to see it.');
                    });
                  }}
                  options={[
                    { key: 'sky', label: 'Sky' },
                    { key: 'light', label: 'Light' },
                  ]}
                />
              </View>
            </Row>
          ) : null}
          <Row icon="play-circle" label="Watch the intro again" onPress={() => router.push({ pathname: '/onboarding', params: { again: '1' } })} />
          <Row icon="image" label="Photo credits" onPress={() => router.push('/credits')} />
          <Row icon="shield" label="Privacy policy" onPress={() => router.push('/privacy')} />
          <Row icon="file-text" label="Terms of use" onPress={() => router.push('/terms')} />
          <Row icon="info" label="Version" value={`${Constants.expoConfig?.version ?? ''} · prototype`} />
        </Section>
      </Animated.View>
    </ScrollView>
    </SkyScreen>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} containerStyle={styles.statSlot} style={styles.stat} accessibilityRole="button" accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="label" color={skyInk.soft}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** A heading, a white group of rows with hairlines between them, and an optional line of help. */
function Section({ title, footer, footerError, children }: { title: string; footer?: string; footerError?: boolean; children?: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section}>
      <Text variant="label" ink="faint" style={styles.sectionTitle}>
        {title}
      </Text>
      {rows.length ? <Glass style={styles.group}>{rows.map((r, i) => (i === 0 ? r : <Divided key={r.key}>{r}</Divided>))}</Glass> : null}
      {footer && footerError ? (
        <ErrorNote style={styles.sectionError}>{footer}</ErrorNote>
      ) : footer ? (
        // With no rows, the footer is the section's only content: it sits right under the title.
        <Text variant="label" ink="soft" tabular color={skyInk.faint} style={[styles.sectionFooter, !rows.length && { marginTop: 0 }]}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

// The hairline starts where the text does, as in iOS lists; the row itself stays full width.
function Divided({ children }: { children: ReactNode }) {
  return (
    <View>
      <View style={styles.hairline} />
      {children}
    </View>
  );
}

/**
 * One row: an icon, a label (with a detail line under it, or a value on the right), and at most
 * one trailing control. Rows that go somewhere get a chevron and the press scale.
 */
function Row({
  icon,
  label,
  detail,
  value,
  onPress,
  chevron = 'chevron-right',
  dimmed,
  children,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  chevron?: IconName;
  dimmed?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <View style={[styles.row, dimmed && styles.dimmed]}>
      <View style={styles.icon}>
        <Icon name={icon} size={16} color={skyInk.strong} />
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text variant="label" ink="soft" tabular numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="label" ink="soft" tabular color={skyInk.soft} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {children}
      {onPress ? <Icon name={chevron} size={16} color={skyInk.faint} /> : null}
    </View>
  );
  return onPress ? (
    <PressableScale onPress={onPress} pressedScale={0.99} accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label}>
      {body}
    </PressableScale>
  ) : (
    body
  );
}

/**
 * Who is signed in and when this phone last backed up, and a way out that keeps everything on the
 * phone.
 */
function BackupSection() {
  const { account, status, backedUpAt, error } = useAccount();
  const [confirming, setConfirming] = useState(false);
  if (!liveEnabled) return null;
  // Past the tabs without an account means signing in was skipped: the way back to it.
  if (!account) {
    return (
      <Section title="Backup" footer="Your places and plans are only on this phone. Sign in with your email to keep them safe if you change phone.">
        <Row
          icon="cloud"
          label="Back up your places"
          detail="With a 6-digit code, no password"
          onPress={() => router.push({ pathname: '/signin', params: { from: 'profile' } })}
        />
      </Section>
    );
  }
  const when = status === 'syncing' ? 'Backing up…' : backedUpAt ? `Backed up ${ago(backedUpAt)}` : 'Backed up';
  return (
    <Section title="Backup" footer={error ?? 'Signing out keeps everything on this phone, and asks for your email again. Your backup stays with your account.'} footerError={!!error}>
      <Row icon="cloud" label={account.name ?? account.email} detail={account.name ? account.email : undefined} value={when} />
      {confirming ? (
        <Row icon="log-out" label="Sign out?" detail="You’ll be asked for your email to come back in">
          <PressableScale
            onPress={() => {
              haptic.light();
              setConfirming(false);
              void signOut();
            }}
            style={styles.pill}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text variant="label">Sign out</Text>
          </PressableScale>
        </Row>
      ) : (
        <Row icon="log-out" label="Sign out" onPress={() => setConfirming(true)} />
      )}
    </Section>
  );
}

/** "just now", "5 min ago", "2 h ago", or a date. */
function ago(at: number) {
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** A district in the home picker: a check on the chosen one, like the planning questions. */
function Choice({ label, detail, on, onPress }: { label: string; detail: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} pressedScale={0.99} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}>
      <View style={[styles.row, styles.choice]}>
        <View style={styles.rowText}>
          <Text variant="body" color={skyInk.strong}>
            {label}
          </Text>
          <Text variant="label" ink="soft" tabular color={skyInk.faint}>
            {detail}
          </Text>
        </View>
        {on ? (
          <View style={styles.check}>
            <Icon name="check" size={12} color={skyOnInk} />
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** A permission: "Allowed" once granted; before that, the one secondary pill style Profile uses. */
function PermissionRow({
  name,
  icon,
  label,
  why,
  permissions,
  ask,
  dimmed,
}: {
  name: keyof Permissions;
  icon: IconName;
  label: string;
  why: string;
  permissions: Permissions;
  ask: (which: keyof Permissions) => Promise<string>;
  dimmed?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const status = permissions[name];
  const granted = status === 'granted';
  // Once the system has been told no, only Settings can change it.
  const blocked = status === 'denied';

  return (
    <Row icon={icon} label={label} detail={granted ? undefined : why} dimmed={dimmed}>
      {granted ? (
        <View style={styles.granted}>
          <Icon name="check" size={13} color={skyInk.soft} />
          <Text variant="label" ink="soft" tabular>Allowed</Text>
        </View>
      ) : (
        <PressableScale
          onPress={async () => {
            if (blocked) {
              Linking.openSettings();
              return;
            }
            setBusy(true);
            await ask(name);
            setBusy(false);
          }}
          style={styles.pill}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={blocked ? `Open Settings to allow ${label}` : `Allow ${label}`}
        >
          <Text variant="label">{busy ? 'Asking…' : blocked ? 'Settings' : 'Allow'}</Text>
        </PressableScale>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: GUTTER + 4, flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerText: { flex: 1, gap: 2 },
  // Wide enough for both words, narrow enough to leave the row's label its room.
  look: { width: 168 },
  nameField: {
    minWidth: 140,
    textAlign: 'right',
    fontFamily: fonts.sansMedium,
    // 16 or more: iPhone browsers zoom the whole page into a smaller text box and stay zoomed.
    fontSize: fontSize.title,
    color: skyInk.soft,
    paddingVertical: 8,
  },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: GUTTER, marginTop: 16 },
  statSlot: { flex: 1 },
  stat: {
    gap: 2,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radii.glass,
    // White and lifted on paper, like the panels below it.
    backgroundColor: skyChip.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyChip.rim,
    boxShadow: isLight ? shadows.card : undefined,
  },
  statValue: {
    fontFamily: fonts.display,
    ...textSize.display,
    letterSpacing: -1,
    color: skyInk.strong,
    fontVariant: ['tabular-nums'],
  },
  section: { marginTop: 24, paddingHorizontal: GUTTER },
  sectionTitle: { marginLeft: 4, marginBottom: 8 },
  sectionFooter: { marginTop: 8, marginHorizontal: 4 },
  sectionError: { marginTop: 8 },
  group: {},
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: skyInk.line, marginLeft: 56, marginRight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 16 },
  dimmed: { opacity: 0.45 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skyFill.pane,
  },
  rowText: { flex: 1, gap: 1 },
  choice: { paddingLeft: 56, minHeight: 50 },
  check: { width: 20, height: 20, borderRadius: 10, backgroundColor: skyInk.strong, alignItems: 'center', justifyContent: 'center' },
  granted: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: skyInk.outline,
    backgroundColor: skyFill.pane,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
