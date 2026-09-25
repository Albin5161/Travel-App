import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { Chips } from '@/components/spots/Chips';
import { allDistricts } from '@/data/regions';
import { haptic } from '@/lib/haptics';
import { fadeUp } from '@/lib/motion';
import { useArrivalWatch, type Permissions } from '@/state/arrival';
import { useSavedSpots, useSpotsByDistrict, useTrips } from '@/state/trips';
import { fonts, light, shadows } from '@/theme/tokens';

const ENTER = [0, 1, 2, 3].map((i) => fadeUp(80 + i * 60));
const GUTTER = 16;

// Background geofencing is not in Expo Go, so the simulate control is the only way to show the
// arrival flow there. Detected rather than assumed, so a development build hides the caveat.
const inExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const { permissions, ask, watching, simulate, targets } = useArrivalWatch();
  const spots = useSavedSpots();
  const groups = useSpotsByDistrict();

  const home = allDistricts.find((d) => d.id === state.homeDistrictId);
  const been = spots.filter((s) => state.spotStatus[s.id] === 'been').length;
  const away = targets.filter((t) => t.districtId !== state.homeDistrictId);

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[light.canvasTop, light.canvas]} style={styles.wash} pointerEvents="none" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }}
      >
        <View style={styles.header}>
          <Text style={styles.wordmark}>Profile</Text>
        </View>

        <Animated.View entering={ENTER[0]} style={styles.statRow}>
          <Stat label="Spots saved" value={spots.length} />
          <Stat label="Districts" value={groups.length} />
          <Stat label="Been" value={been} />
        </Animated.View>

        <Animated.View entering={ENTER[1]}>
          <Card
            title="Where you live"
            detail="Everything near-home follows from this: your weekend list, and which districts are worth telling you about when you arrive."
          >
            <Chips
              value={state.homeDistrictId}
              onChange={(id) => id && dispatch({ type: 'setHomeDistrict', districtId: id })}
              options={allDistricts.map((d) => ({ key: d.id as string | null, label: d.name }))}
            />
          </Card>
        </Animated.View>

        <Animated.View entering={ENTER[2]}>
          <Card
            title="Tell me when I arrive"
            detail={`One notification when you enter a district you've saved spots in — not a ping for every café you drive past. ${
              away.length > 0
                ? `${away.length} ${away.length === 1 ? 'district' : 'districts'} away from ${home?.name ?? 'home'} would qualify.`
                : 'Save a spot outside your district and this starts to matter.'
            }`}
          >
            <Row
              label="Arrival notifications"
              detail={
                watching > 0
                  ? `Watching ${watching} ${watching === 1 ? 'district' : 'districts'}`
                  : 'Off — needs the permissions below'
              }
            >
              <Switch
                value={state.notifyOnArrival}
                onValueChange={(on) => {
                  haptic.selection();
                  dispatch({ type: 'setNotifyOnArrival', on });
                }}
                trackColor={{ true: light.cta, false: light.lineStrong }}
                thumbColor={light.panel}
                ios_backgroundColor={light.lineStrong}
              />
            </Row>

            <Permission
              name="notifications"
              label="Show notifications"
              permissions={permissions}
              ask={ask}
              why="Without this the arrival still shows as a banner inside the app, but not on your lock screen."
            />
            <Permission
              name="background"
              label="Location, always"
              permissions={permissions}
              ask={ask}
              why="The only way an arrival can reach you while Raahi is closed. iOS calls it “Always Allow”."
            />

            {inExpoGo ? (
              <View style={styles.note}>
                <Feather name="info" size={14} color={light.inkSoft} />
                <Text variant="data" style={{ flex: 1 }}>
                  Real geofencing needs a development build — it doesn&rsquo;t run in Expo Go. Simulate an
                  arrival below to see the whole flow.
                </Text>
              </View>
            ) : null}
          </Card>
        </Animated.View>

        <Animated.View entering={ENTER[3]}>
          <Card
            title="Simulate an arrival"
            detail="Runs the same path a real geofence would: the notification, the banner, and the map opening on that district."
          >
            {away.length === 0 ? (
              <Text variant="body">
                Nothing to simulate yet — every spot you&rsquo;ve saved is in {home?.name ?? 'your district'}.
              </Text>
            ) : (
              away.map((t) => (
                <PressableScale
                  key={t.districtId}
                  onPress={() => {
                    haptic.success();
                    simulate(t.districtId);
                  }}
                  containerStyle={styles.simulateSlot}
                  style={styles.simulate}
                  accessibilityRole="button"
                  accessibilityLabel={`Simulate arriving in ${t.name}`}
                >
                  <Feather name="map-pin" size={15} color={light.ctaInk} />
                  <Text variant="label" color={light.ctaInk} style={{ flex: 1 }}>
                    Arrive in {t.name}
                  </Text>
                  <Text variant="data" color="rgba(255,255,255,0.65)">
                    {t.spots} {t.spots === 1 ? 'spot' : 'spots'}
                  </Text>
                </PressableScale>
              ))
            )}
          </Card>
        </Animated.View>

        <PressableScale
          onPress={() => router.push('/credits')}
          accessibilityRole="button"
          accessibilityLabel="Photo credits"
          style={styles.creditsRow}
        >
          <Feather name="image" size={15} color={light.ink} />
          <Text variant="label" style={styles.creditsLabel}>
            Photo credits
          </Text>
          <Feather name="chevron-right" size={16} color={light.inkFaint} />
        </PressableScale>

        <Text variant="data" color={light.inkFaint} style={styles.footer}>
          Raahi {Constants.expoConfig?.version ?? ''} · prototype. Saved spots live in memory for now,
          so they reset when the app restarts.
        </Text>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="micro">{label}</Text>
    </View>
  );
}

function Card({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text variant="headline">{title}</Text>
      <Text variant="body" style={{ marginTop: 2 }}>
        {detail}
      </Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function Row({
  label,
  detail,
  children,
}: {
  label: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {detail ? <Text variant="data">{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Permission({
  name,
  label,
  why,
  permissions,
  ask,
}: {
  name: keyof Permissions;
  label: string;
  why: string;
  permissions: Permissions;
  ask: (which: keyof Permissions) => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const status = permissions[name];
  const granted = status === 'granted';
  // Once iOS has been told no, only Settings can change it.
  const blocked = status === 'denied';

  return (
    <Row label={label} detail={granted ? 'Allowed' : why}>
      {granted ? (
        <View style={styles.tick}>
          <Feather name="check" size={14} color={light.ctaInk} />
        </View>
      ) : (
        <PressableScale
          onPress={async () => {
            if (blocked) {
              Linking.openURL(Platform.OS === 'ios' ? 'app-settings:' : 'app-settings:').catch(() => {});
              return;
            }
            setBusy(true);
            await ask(name);
            setBusy(false);
          }}
          style={styles.allow}
          accessibilityRole="button"
          accessibilityLabel={blocked ? `Open settings to allow ${label}` : `Allow ${label}`}
        >
          <Text variant="label" color={light.ctaInk}>
            {busy ? '…' : blocked ? 'Settings' : 'Allow'}
          </Text>
        </PressableScale>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 240 },
  header: { paddingHorizontal: GUTTER, paddingBottom: 18 },
  wordmark: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.8, color: light.ink },
  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER },
  stat: {
    flex: 1,
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1.1,
    color: light.ink,
    fontVariant: ['tabular-nums'],
  },
  card: {
    marginTop: 14,
    marginHorizontal: GUTTER,
    padding: 18,
    borderRadius: 26,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.button,
  },
  cardBody: { marginTop: 14, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: light.line,
  },
  allow: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: light.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: light.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulateSlot: { alignSelf: 'stretch' },
  simulate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: light.cta,
  },
  note: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'flex-start' },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
  },
  creditsLabel: { flex: 1 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 22, lineHeight: 18 },
});
