import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PasteButton } from '@/components/PasteButton';
import { PressableScale } from '@/components/PressableScale';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { sendEmailCode, verifyEmailCode } from '@/lib/live/account';
import { fadeUp } from '@/lib/motion';
import { useOffline } from '@/lib/online';
import { skyFill, skyInk } from '@/theme/sky';
import { fonts, space } from '@/theme/tokens';

const CODE_LENGTH = 6;
/** How long before another code can be asked for: Supabase refuses sooner anyway. */
const RESEND_AFTER = 60;
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
/** The code in whatever was copied: the code alone, or the email's whole text around it. */
const codeIn = (text: string) => text.match(/(^|\D)(\d{6})(\D|$)/)?.[2] ?? (/^\d{6}$/.test(text.replace(/\s/g, '')) ? text.replace(/\s/g, '') : null);

/**
 * Signing in with an email: the step after your name, and asked of everyone (Albin's choice for
 * the testing group). An email, then the 6-digit code sent to it; no password. Signed in, the
 * phone's saved places are backed up to the account and come back on any other phone
 * (lib/live/account). The tabs send anyone here who isn't signed in yet.
 */
export default function SignIn() {
  const insets = useSafeAreaInsets();
  const offline = useOffline();
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [unsent, setUnsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeInput = useRef<TextInput>(null);
  // Each request to send a code; an answer to an older one (Back, then another email) is ignored.
  const asked = useRef(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // The code screen comes straight away: Supabase only answers once Gmail has sent the email, a
  // few seconds, and the person would otherwise watch "Sending…". A failure shows on the code screen.
  const send = () => {
    if (!looksLikeEmail(email)) {
      setError('That doesn’t look like an email address.');
      haptic.error();
      return;
    }
    if (sending) return;
    const ask = ++asked.current;
    haptic.light();
    setError(null);
    setCode('');
    setWait(RESEND_AFTER);
    setSending(true);
    setUnsent(false);
    setStage('code');
    setTimeout(() => codeInput.current?.focus(), 350);
    void sendEmailCode(email).then((sent) => {
      if (ask !== asked.current) return;
      setSending(false);
      if (!sent.ok) {
        setUnsent(true);
        setError(sent.message);
        setWait(0);
        haptic.error();
        return;
      }
      track('email code sent');
    });
  };

  const check = async (value = code) => {
    if (value.length < CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    const done = await verifyEmailCode(email, value);
    setBusy(false);
    if (!done.ok) {
      setError(done.message);
      haptic.error();
      return;
    }
    haptic.success();
    track('signed in', { with: 'email' });
    router.replace('/');
  };

  const onCode = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    // The whole code typed, or filled in from the email by iOS: checked straight away.
    if (digits.length === CODE_LENGTH) void check(digits);
  };

  const onEmail = stage === 'email';
  const note = error ?? (offline ? 'You’re offline. Signing in needs the internet.' : null);

  return (
    <SkyScreen>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            {onEmail ? (
              <Text style={styles.wordmark}>Xplore</Text>
            ) : (
              <PressableScale
                onPress={() => {
                  asked.current++;
                  setSending(false);
                  setStage('email');
                  setError(null);
                }}
                style={styles.back}
                accessibilityRole="button"
                accessibilityLabel="Use a different email"
              >
                <Feather name="chevron-left" size={18} color={skyInk.soft} />
                <Text variant="label" color={skyInk.soft}>
                  Back
                </Text>
              </PressableScale>
            )}
          </View>

          <Animated.View key={stage} entering={fadeUp(0)} style={styles.body}>
            <View style={styles.copy}>
              <Text style={styles.title} accessibilityRole="header">
                {onEmail ? 'Last step.\nYour email?' : 'Check your email.'}
              </Text>
              <Text variant="body">
                {onEmail
                  ? 'We’ll send you a 6-digit code. No password. Your places and plans are backed up to it, so they’re safe if you change phone.'
                  : sending
                    ? `Sending a 6-digit code to ${email.trim()}…`
                    : unsent
                      ? `We couldn’t send a code to ${email.trim()}.`
                      : `We sent a 6-digit code to ${email.trim()}. It can take a minute, and may land in spam. Copied it? Tap paste.`}
              </Text>
            </View>

            {onEmail ? (
              // Its own key: iOS keeps the code field's letter spacing on a reused field after Back.
              <TextInput
                key="email"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(null);
                }}
                onSubmitEditing={send}
                placeholder="you@example.com"
                placeholderTextColor={skyInk.faint}
                selectionColor={skyInk.strong}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="send"
                autoFocus
                style={styles.input}
                accessibilityLabel="Your email address"
              />
            ) : (
              <View style={styles.codeRow}>
              <TextInput
                key="code"
                ref={codeInput}
                value={code}
                onChangeText={onCode}
                placeholder="000000"
                placeholderTextColor={skyInk.faint}
                selectionColor={skyInk.strong}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={CODE_LENGTH}
                style={[styles.input, styles.code, styles.fill]}
                accessibilityLabel={`The ${CODE_LENGTH}-digit code from the email`}
              />
              {/* Gmail can't fill the code in the way Apple's Mail can: copy it there, paste it here. */}
              <PasteButton
                shape="circle"
                quiet
                size={54}
                onText={(text) => {
                  const found = codeIn(text);
                  if (found) onCode(found);
                  else {
                    setError('No 6-digit code in what you copied.');
                    haptic.error();
                  }
                }}
                onUnreadable={() => setError('Couldn’t read what you copied. Long-press the box to paste.')}
              />
              </View>
            )}

            <View style={styles.noteSlot}>
              {note ? (
                <Text variant="label" color={error ? skyInk.strong : skyInk.soft} accessibilityLiveRegion="polite">
                  {note}
                </Text>
              ) : null}
            </View>
          </Animated.View>

          <View style={styles.actions}>
            {onEmail ? (
              <Button
                trailingArrow
                label="Send code"
                onPress={send}
                disabled={!email.trim()}
              />
            ) : (
              <>
                <Button
                  trailingArrow
                  label={busy ? 'Checking…' : 'Sign in'}
                  onPress={() => void check()}
                  disabled={busy || code.length < CODE_LENGTH}
                />
                <Button
                  kind="text"
                  label={wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
                  onPress={send}
                  disabled={busy || sending || wait > 0}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SkyScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flexGrow: 1, paddingHorizontal: space.screen },
  topRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  wordmark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.9, color: skyInk.strong },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingRight: 8, marginLeft: -4 },
  body: { flex: 1, justifyContent: 'center', gap: 24, paddingVertical: 24 },
  copy: { gap: 12 },
  // The display size every screen title uses, as on the name step before this one.
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: skyInk.strong, letterSpacing: -1.1 },
  input: {
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: skyFill.raised,
    borderWidth: 1,
    borderColor: skyInk.rim,
    fontFamily: fonts.sansMedium,
    // 16 or more: iPhone browsers zoom the page into a smaller text box.
    fontSize: 17,
    color: skyInk.strong,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontFamily: fonts.sansSemi },
  noteSlot: { minHeight: 20 },
  actions: { gap: 4 },
});
