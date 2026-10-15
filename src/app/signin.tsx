import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ErrorNote } from '@/components/ErrorNote';
import { PasteButton } from '@/components/PasteButton';
import { PressableScale } from '@/components/PressableScale';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { track } from '@/lib/analytics';
import { suggestEmail } from '@/lib/emailTypos';
import { haptic } from '@/lib/haptics';
import { sendEmailCode, usedCode, verifyEmailCode } from '@/lib/live/account';
import { fadeUp } from '@/lib/motion';
import { useOffline } from '@/lib/online';
import { skyDanger, skyFill, skyInk } from '@/theme/sky';
import { fonts, space } from '@/theme/tokens';

const CODE_LENGTH = 6;
// Web only: the browser's own focus ring is the system accent (orange) and narrower than the pill;
// the pill's strong border shows focus instead (as LinkBox does). RN's types don't list 'none'.
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
/** How long before another code can be asked for: Supabase refuses sooner anyway. */
const RESEND_AFTER = 60;
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
/** The code in whatever was copied: the code alone, or the email's whole text around it. */
const codeIn = (text: string) => text.match(/(^|\D)(\d{6})(\D|$)/)?.[2] ?? (/^\d{6}$/.test(text.replace(/\s/g, '')) ? text.replace(/\s/g, '') : null);

/**
 * Signing in with an email: the step after the intro, before the name, and asked of everyone
 * (Albin's choice for the testing group). An email, then the 6-digit code sent to it; no password.
 * Signed in, the phone's saved places are backed up to the account and come back on any other phone
 * (lib/live/account). The tabs send anyone here who isn't signed in yet.
 *
 * Laid out as sign-ups usually are (Booking.com, Luma, Strava on Mobbin): the words and the field
 * at the top where the keyboard can't cover them, the button just above the keyboard, the code in
 * six boxes with the address it went to and a way to change it.
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
  const [emailFocused, setEmailFocused] = useState(false);
  const codeInput = useRef<TextInput>(null);
  // Each request to send a code; an answer to an older one (Back, then another email) is ignored.
  const asked = useRef(0);
  // The code last put in with Paste: once it signs in, it's cleared from the clipboard so a later
  // sign-in can't paste it again.
  const pasted = useRef<string | null>(null);

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
    if (pasted.current === value) void Clipboard.setStringAsync('').catch(() => {});
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
  const backToEmail = () => {
    asked.current++;
    setSending(false);
    setStage('email');
    setError(null);
  };
  // A slip in the provider ("gmial.com") means the code never arrives: offered, never forced.
  const suggestion = onEmail && looksLikeEmail(email) ? suggestEmail(email) : null;
  const note =
    (offline
      ? 'You’re offline. Signing in needs the internet.'
      : !onEmail && !sending && !unsent
        ? 'It can take a minute, and may land in spam.'
        : null);

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
              <PressableScale onPress={backToEmail} style={styles.back} accessibilityRole="button" accessibilityLabel="Use a different email">
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
                {onEmail ? 'What’s your email?' : 'Check your email.'}
              </Text>
              {onEmail ? (
                <Text variant="body">
                  We’ll send you a 6-digit code to sign in. No password. Your places and plans are backed up to it, so they’re safe if you change phone.
                </Text>
              ) : (
                <Text variant="body">
                  {sending ? 'Sending a 6-digit code to ' : unsent ? 'We couldn’t send a code to ' : 'Enter the 6-digit code we sent to '}
                  <Text variant="body" style={styles.address}>
                    {email.trim()}
                  </Text>
                  {sending ? '…' : '. '}
                  {sending ? null : (
                    <Text variant="body" style={styles.change} onPress={backToEmail} accessibilityRole="link" accessibilityLabel="Change the email">
                      Change
                    </Text>
                  )}
                </Text>
              )}
            </View>

            {onEmail ? (
              <View style={styles.field}>
                <Text variant="label" color={skyInk.soft}>
                  Email
                </Text>
                {/* Its own key: iOS reuses text fields between the two steps. */}
                <TextInput
                  key="email"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setError(null);
                  }}
                  onSubmitEditing={send}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="you@example.com"
                  placeholderTextColor={skyInk.faint}
                  selectionColor={skyInk.strong}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  returnKeyType="go"
                  clearButtonMode="while-editing"
                  autoFocus
                  style={[styles.input, NO_FOCUS_RING, emailFocused && styles.inputFocused, !!error && styles.inputError]}
                  accessibilityLabel="Your email address"
                />
                {suggestion ? (
                  <PressableScale
                    onPress={() => {
                      haptic.selection();
                      setEmail(suggestion);
                      setError(null);
                    }}
                    style={styles.suggestion}
                    accessibilityRole="button"
                    accessibilityLabel={`Did you mean ${suggestion}? Tap to use it`}
                  >
                    <Text variant="label" color={skyInk.soft}>
                      Did you mean{' '}
                      <Text variant="label" style={styles.suggested}>
                        {suggestion}
                      </Text>
                      ?
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
            ) : (
              <View style={styles.field}>
                <CodeBoxes value={code} inputRef={codeInput} onChange={onCode} wrong={!!error && !sending} />
                <View style={styles.codeTools}>
                  <PressableScale
                    onPress={send}
                    disabled={busy || sending || wait > 0}
                    style={styles.resend}
                    accessibilityRole="button"
                    accessibilityLabel={wait > 0 ? `Send a new code in ${wait} seconds` : 'Send a new code'}
                  >
                    <Text variant="label" color={busy || sending || wait > 0 ? skyInk.faint : skyInk.strong} style={!(busy || sending || wait > 0) && styles.resendOn}>
                      {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
                    </Text>
                  </PressableScale>
                  {/* Gmail can't fill the code in the way Apple's Mail can: copy it there, paste it here. */}
                  <PasteButton
                    quiet
                    onText={(text) => {
                      const found = codeIn(text);
                      if (!found) {
                        setError('No 6-digit code in what you copied.');
                        haptic.error();
                      } else if (usedCode(found)) {
                        setError('That code is from an earlier email. Copy the one in the newest email.');
                        haptic.error();
                      } else {
                        pasted.current = found;
                        onCode(found);
                      }
                    }}
                    onUnreadable={() => setError('Couldn’t read what you copied. Long-press the boxes to paste.')}
                  />
                </View>
              </View>
            )}

            <View style={styles.noteSlot}>
              {error ? (
                <ErrorNote>{error}</ErrorNote>
              ) : note ? (
                <Text variant="label" color={skyInk.faint} accessibilityLiveRegion="polite">
                  {note}
                </Text>
              ) : null}
            </View>
          </Animated.View>

          <View style={styles.actions}>
            {onEmail ? (
              <Button trailingArrow label="Continue" onPress={send} disabled={!email.trim()} />
            ) : (
              <Button
                trailingArrow
                label={busy ? 'Checking…' : 'Sign in'}
                onPress={() => void check()}
                disabled={busy || code.length < CODE_LENGTH}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SkyScreen>
  );
}

/**
 * The code as six boxes, the way sign-ups show it. One real field lies over them, unseen, so
 * typing, the keyboard's code suggestion (from Messages or Mail) and long-press paste all work as
 * in any field; the boxes only show what it holds and where the next digit goes.
 */
function CodeBoxes({
  value,
  inputRef,
  onChange,
  wrong,
}: {
  value: string;
  inputRef: RefObject<TextInput | null>;
  onChange: (text: string) => void;
  /** The code was refused: the boxes take the error red. */
  wrong: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const next = Math.min(value.length, CODE_LENGTH - 1);
  return (
    <View style={styles.boxes}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <View key={i} style={[styles.box, focused && i === next && styles.boxOn, wrong && styles.boxWrong]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.digit}>{value[i] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        key="code"
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
        caretHidden
        selectionColor="transparent"
        style={styles.hiddenInput}
        accessibilityLabel={`The ${CODE_LENGTH}-digit code from the email`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flexGrow: 1, paddingHorizontal: space.screen },
  topRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  wordmark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.9, color: skyInk.strong },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingRight: 8, marginLeft: -4 },
  // From the top, so the keyboard never covers the words or the field; the button sits below.
  body: { flex: 1, gap: 24, paddingTop: 24, paddingBottom: 16 },
  copy: { gap: 12 },
  // The display size every screen title uses, as on the name step.
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: skyInk.strong, letterSpacing: -1.1 },
  address: { fontFamily: fonts.sansSemi, color: skyInk.strong },
  change: { color: skyInk.strong, textDecorationLine: 'underline' },
  field: { gap: 8 },
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
  inputFocused: { borderColor: skyInk.strong },
  // The field at fault, in the error red (Semantic.danger).
  inputError: { borderColor: skyDanger.line, borderWidth: 1.5 },
  suggestion: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  suggested: { color: skyInk.strong, textDecorationLine: 'underline' },
  boxes: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skyFill.raised,
    borderWidth: 1,
    borderColor: skyInk.rim,
  },
  // The box the next digit goes in: the strong ink, as anything chosen or on.
  boxOn: { borderColor: skyInk.strong, borderWidth: 1.5 },
  boxWrong: { borderColor: skyDanger.line, borderWidth: 1.5 },
  digit: { fontFamily: fonts.sansSemi, fontSize: 26, lineHeight: 32, color: skyInk.strong, fontVariant: ['tabular-nums'] },
  // Unseen but there: it takes the taps, the typing and the paste. Not opacity 0: iOS passes taps
  // through anything under 1% opaque, and the boxes could no longer bring the keyboard back. Its
  // text and caret are transparent anyway. No letterSpacing on a text field (iOS reuses fields and
  // carried it into others' placeholders); 16pt so browsers don't zoom.
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0.02, color: 'transparent', fontSize: 16 },
  codeTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  resend: { minHeight: 44, justifyContent: 'center' },
  resendOn: { textDecorationLine: 'underline' },
  noteSlot: { minHeight: 20 },
  actions: { gap: 4 },
});
