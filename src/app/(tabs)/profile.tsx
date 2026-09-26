import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Children, isValidElement, useState, type ComponentProps, type ReactNode } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/PressableScale';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { Text } from '@/components/Text';
import { allDistricts } from '@/data/regions';
import { haptic } from '@/lib/haptics';
import { fadeUp, REFLOW } from '@/lib/motion';
import { useArrivalWatch, type Permissions } from '@/state/arrival';
import { useSavedSpots, useTrips } from '@/state/trips';
import { fonts, light } from '@/theme/tokens';

type IconName = ComponentProps<typeof Feather>['name'];

const ENTER = [0, 1, 2, 3, 4, 5].map((i) => fadeUp(60 + i * 50));
const GUTTER = 16;

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
    <ScrollView
      style={styles.fill}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 110 }}
    >
      <Animated.View entering={ENTER[0]} style={styles.header}>
        <ProfilePhoto size={72} />
        <View style={styles.headerText}>
          <Text variant="display" numberOfLines={1}>
            {state.myName ?? 'Profile'}
          </Text>
          <Text variant="data">{home ? `Home in ${home.name}` : 'No home district yet'}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={ENTER[1]} style={styles.stats}>
        <Stat value={spots.length} label="Spots" onPress={() => router.navigate('/map')} />
        <Stat value={trips} label="Trips" onPress={() => router.navigate('/trips')} />
        <Stat value={been} label="Been" onPress={() => router.navigate('/map')} />
      </Animated.View>

      <Animated.View entering={ENTER[2]}>
        <Section title="You" footer="Friends see your name and photo on trips you share. Your weekend outings, and which places count as away, follow from home.">
          <Row icon="user" label="Name">
            <TextInput
              value={name}
              onChangeText={setName}
              onEndEditing={() => dispatch({ type: 'setMyName', name })}
              onBlur={() => dispatch({ type: 'setMyName', name })}
              placeholder="Add your name"
              placeholderTextColor={light.inkFaint}
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
              trackColor={{ true: light.ink, false: light.lineStrong }}
              thumbColor={light.panel}
              ios_backgroundColor={light.lineStrong}
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
              : `Every spot you've saved is in ${home?.name ?? 'your district'}. Save one somewhere else to try this.`
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
        <Section title="About" footer="Everything you save lives on this phone for now, and resets when the app restarts.">
          <Row icon="image" label="Photo credits" onPress={() => router.push('/credits')} />
          <Row icon="shield" label="Privacy policy" onPress={() => router.push('/privacy')} />
          <Row icon="file-text" label="Terms of use" onPress={() => router.push('/terms')} />
          <Row icon="info" label="Version" value={`${Constants.expoConfig?.version ?? ''} · prototype`} />
        </Section>
      </Animated.View>
    </ScrollView>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} containerStyle={styles.statSlot} style={styles.stat} accessibilityRole="button" accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="label" color={light.inkSoft}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** A heading, a white group of rows with hairlines between them, and an optional line of help. */
function Section({ title, footer, children }: { title: string; footer?: string; children?: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section}>
      <Text variant="micro" style={styles.sectionTitle}>
        {title}
      </Text>
      {rows.length ? <View style={styles.group}>{rows.map((r, i) => (i === 0 ? r : <Divided key={r.key}>{r}</Divided>))}</View> : null}
      {footer ? (
        <Text variant="data" color={light.inkFaint} style={styles.sectionFooter}>
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
        <Feather name={icon} size={16} color={light.ink} />
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text variant="data" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="data" color={light.inkSoft} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {children}
      {onPress ? <Feather name={chevron} size={16} color={light.inkFaint} /> : null}
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

/** A district in the home picker: a check on the chosen one, like the planning questions. */
function Choice({ label, detail, on, onPress }: { label: string; detail: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} pressedScale={0.99} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}>
      <View style={[styles.row, styles.choice]}>
        <View style={styles.rowText}>
          <Text variant="body" color={light.ink}>
            {label}
          </Text>
          <Text variant="data" color={light.inkFaint}>
            {detail}
          </Text>
        </View>
        {on ? (
          <View style={styles.check}>
            <Feather name="check" size={12} color={light.ctaInk} />
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
          <Feather name="check" size={13} color={light.inkSoft} />
          <Text variant="data">Allowed</Text>
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
  fill: { flex: 1, backgroundColor: light.canvas },
  header: { paddingHorizontal: GUTTER + 4, flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerText: { flex: 1, gap: 2 },
  nameField: {
    minWidth: 140,
    textAlign: 'right',
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: light.inkSoft,
    paddingVertical: 6,
  },
  stats: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER, marginTop: 18 },
  statSlot: { flex: 1 },
  stat: {
    gap: 2,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -1,
    color: light.ink,
    fontVariant: ['tabular-nums'],
  },
  section: { marginTop: 26, paddingHorizontal: GUTTER },
  sectionTitle: { marginLeft: 4, marginBottom: 8 },
  sectionFooter: { marginTop: 8, marginHorizontal: 4, lineHeight: 18 },
  group: {
    borderRadius: 20,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    overflow: 'hidden',
  },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: light.lineStrong, marginLeft: 56 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 14 },
  dimmed: { opacity: 0.45 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.canvas,
  },
  rowText: { flex: 1, gap: 1 },
  choice: { paddingLeft: 56, minHeight: 50 },
  check: { width: 20, height: 20, borderRadius: 10, backgroundColor: light.ink, alignItems: 'center', justifyContent: 'center' },
  granted: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: light.lineStrong,
    backgroundColor: light.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
