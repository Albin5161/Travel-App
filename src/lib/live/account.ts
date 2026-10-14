import { reloadAppAsync } from 'expo';
import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { ensureUser, getSupabase, liveEnabled } from '@/lib/live/client';
import { canon, mergeTrips, parse, type SavedTrips } from '@/lib/live/backupMerge';
import { deviceStorage } from '@/lib/live/storage';

// Signing in, with an email and a 6-digit code (app/signin), asked of everyone. What it buys is a
// backup: the saved places and plans this phone keeps (state/trips) are also kept with the account,
// in the saved_collections table (supabase/api.sql, one row a person, only theirs), and come back on
// a new phone or browser after signing in there.
//
// The anonymous account every phone already has is turned into the email one rather than replaced
// (an email change), so the same person stays a member of the trips they share. When that email is
// already someone's (signed in on another phone first), this phone switches to it instead, and what
// it holds is merged into that account's backup.

export type Account = { email: string; name: string | null; avatar: string | null };
type Status = 'idle' | 'syncing' | 'error';
type Snapshot = { account: Account | null; status: Status; backedUpAt: number | null; error: string | null };

/** Where the trips are saved on this phone (state/trips). The backup is a copy of exactly that. */
const TRIPS_KEY = 'xplore.trips.v1';
const NAME_KEY = 'xplore.name';
/** Who is signed in, kept so the app knows at start without loading anything. */
const ACCOUNT_KEY = 'xplore.account';
/** When a restore last restarted the app, so two phones' copies can never restart it in a loop. */
const RESTARTED_KEY = 'xplore.backup.restartedAt';
/**
 * When this phone last sent its copy, and to whom. The account's copy is only merged in when it is
 * newer than that, that is, when another phone or browser has saved since: otherwise this phone's
 * copy is already the latest, and merging would bring back what was deleted here.
 */
const PUSHED_KEY = 'xplore.backup.pushed';
const pushedFor = (userId: string) => {
  try {
    const p = JSON.parse(read(PUSHED_KEY) ?? 'null') as { userId: string; at: number } | null;
    return p?.userId === userId ? p.at : 0;
  } catch {
    return 0;
  }
};

const read = (key: string) => {
  try {
    return deviceStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) deviceStorage?.removeItem(key);
    else deviceStorage?.setItem(key, value);
  } catch {
    // No storage: signed in for as long as the app is open.
  }
};

const saved = (() => {
  try {
    return JSON.parse(read(ACCOUNT_KEY) ?? 'null') as Account | null;
  } catch {
    return null;
  }
})();
let snap: Snapshot = { account: saved, status: 'idle', backedUpAt: null, error: null };
const listeners = new Set<() => void>();
const set = (next: Partial<Snapshot>) => {
  snap = { ...snap, ...next };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Who is signed in, if anyone, and how the backup stands. */
export function useAccount(): Snapshot {
  return useSyncExternalStore(subscribe, () => snap, () => snap);
}

/** A real account (an email), as against the anonymous one every phone starts with. */
const isPermanent = (user: User | null | undefined) => !!user && !user.is_anonymous && !!user.email;
const accountOf = (user: User): Account => ({
  email: user.email ?? '',
  name: (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined) ?? null,
  avatar: (user.user_metadata?.avatar_url as string | undefined) ?? null,
});

/** Whoever just signed in with an email code: remembered, then their backup brought in. */
async function signedIn(supabase: SupabaseClient, user: User | null) {
  if (!user || !isPermanent(user)) throw new Error('Not signed in');
  const account = accountOf(user);
  write(ACCOUNT_KEY, JSON.stringify(account));
  set({ account, status: 'idle', error: null });
  await restore(supabase, user.id);
}

// ── Signing in with an email code ────────────────────────────────────────────────────────────

/**
 * How the code being waited for will be checked. A new email turns this phone's anonymous account
 * into an email one (an email change, so it's the same person on their shared trips); an email
 * that already has an account (signed in on another phone first) signs in to that one instead.
 */
let codeFor: { email: string; kind: 'email_change' | 'email' } | null = null;

export type CodeResult = { ok: true } | { ok: false; message: string };

const codeError = (e: unknown): string => {
  const m = e instanceof Error ? e.message : '';
  if (/only request this after|rate limit|too many/i.test(m)) return 'Too many codes asked for. Wait a minute and try again.';
  if (/invalid.*email|unable to validate email/i.test(m)) return 'That doesn’t look like an email address.';
  if (/error sending|smtp|confirmation email/i.test(m)) return 'Couldn’t send the email just now. Try again in a minute.';
  if (/expired|invalid/i.test(m)) return 'That code didn’t work. Check it, or ask for a new one.';
  return 'Couldn’t reach Xplore. Check your connection and try again.';
};

/**
 * Gives up on a request after a while. On a weak connection the phone can wait a long time for an
 * answer that never comes, and the button sat on "Sending…" with nothing said.
 */
function inTime<T>(work: Promise<T>, ms = 20_000): Promise<T> {
  return Promise.race([work, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);
}

/** Emails a 6-digit code to sign in with. */
export function sendEmailCode(email: string): Promise<CodeResult> {
  return inTime(sendCode(email)).catch((e: unknown) => ({ ok: false as const, message: codeError(e) }));
}

async function sendCode(email: string): Promise<CodeResult> {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, message: 'Sign-in isn’t available in this version.' };
  const address = email.trim().toLowerCase();
  try {
    await ensureUser();
    const { data } = await supabase.auth.getUser();
    if (data.user?.is_anonymous) {
      const changed = await supabase.auth.updateUser({ email: address });
      if (!changed.error) {
        codeFor = { email: address, kind: 'email_change' };
        return { ok: true };
      }
      if (!/already|exists|registered/i.test(changed.error.message) && changed.error.code !== 'email_exists') throw changed.error;
    }
    // Someone already has this email: a code to sign in as them.
    const sent = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    if (sent.error) throw sent.error;
    codeFor = { email: address, kind: 'email' };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: codeError(e) };
  }
}

/** Checks the code from the email; signed in, the backup comes in (and may restart the app). */
export function verifyEmailCode(email: string, code: string): Promise<CodeResult> {
  return inTime(verifyCode(email, code), 30_000).catch((e: unknown) => ({ ok: false as const, message: codeError(e) }));
}

async function verifyCode(email: string, code: string): Promise<CodeResult> {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, message: 'Sign-in isn’t available in this version.' };
  const address = email.trim().toLowerCase();
  const kind = codeFor?.email === address ? codeFor.kind : 'email';
  try {
    const { data, error } = await supabase.auth.verifyOtp({ email: address, token: code.trim(), type: kind });
    if (error) throw error;
    const user = data.user ?? (await supabase.auth.getUser()).data.user;
    codeFor = null;
    await signedIn(supabase, user);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: codeError(e) };
  }
}

/** Signs out. Everything saved stays on this phone; the backup stays with the account. */
export async function signOut() {
  const supabase = await getSupabase();
  await supabase?.auth.signOut().catch(() => {});
  write(ACCOUNT_KEY, null);
  write(PUSHED_KEY, null);
  set({ account: null, status: 'idle', backedUpAt: null, error: null });
}

// ── The backup ───────────────────────────────────────────────────────────────────────────────

type Backup = { trips: SavedTrips | null; name: string | null; savedAt: number };

async function push(supabase: SupabaseClient, userId: string) {
  const backup: Backup = { trips: parse(read(TRIPS_KEY)), name: read(NAME_KEY), savedAt: Date.now() };
  const { error } = await supabase.from('saved_collections').upsert({ user_id: userId, data: backup, updated_at: new Date().toISOString() });
  if (error) throw error;
  write(PUSHED_KEY, JSON.stringify({ userId, at: backup.savedAt }));
  set({ backedUpAt: backup.savedAt, status: 'idle', error: null });
}

/**
 * Brings the account's backup and this phone's copy together: the merged copy is saved on the
 * phone and back to the account. When the phone gained something, the app starts again to show
 * it (the saved copy is only read at start), at most once a minute.
 */
async function restore(supabase: SupabaseClient, userId: string) {
  set({ status: 'syncing' });
  try {
    const { data, error } = await supabase.from('saved_collections').select('data').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    const theirs = (data?.data as Backup | undefined) ?? null;
    if (!theirs || theirs.savedAt <= pushedFor(userId)) {
      // Nothing newer there than what this phone sent: this phone's copy stands.
      await push(supabase, userId);
      return;
    }
    const mine = parse(read(TRIPS_KEY));
    const merged = mergeTrips(mine, theirs?.trips ?? null);
    const gained = JSON.stringify(canon(merged)) !== JSON.stringify(canon(mine));
    if (!read(NAME_KEY) && theirs?.name) write(NAME_KEY, theirs.name);
    const last = Number(read(RESTARTED_KEY) ?? 0);
    if (gained && merged && Date.now() - last > 60_000) {
      // Saved and straight into a restart, before the running app can save its older copy over
      // it. The next start sends the merged copy back to the account.
      write(TRIPS_KEY, JSON.stringify(merged));
      write(RESTARTED_KEY, String(Date.now()));
      if (Platform.OS === 'web') window.location.reload();
      else await reloadAppAsync('Backup restored');
      return;
    }
    await push(supabase, userId);
  } catch {
    set({ status: 'error', error: 'Couldn’t reach your backup. It will try again.' });
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
/**
 * The phone's copy changed (state/trips saves it on every change): sent to the account a few
 * seconds after the last change, not on each one. Nothing happens when nobody is signed in.
 */
export function scheduleBackup() {
  if (!snap.account || !liveEnabled) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void (async () => {
      const supabase = await getSupabase();
      const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
      if (!supabase || !isPermanent(data.user)) return;
      await push(supabase, data.user!.id).catch(() => set({ status: 'error', error: 'Couldn’t back up. It will try again.' }));
    })();
  }, 4000);
}

/**
 * Mounted once at the root. When someone is signed in, picks up what they saved on their other
 * phone or browser since this one last looked, once per start.
 */
export function useAccountSync() {
  useEffect(() => {
    if (!snap.account || !liveEnabled) return;
    let alive = true;
    void (async () => {
      const supabase = await getSupabase();
      if (!alive || !supabase) return;
      const { data, error } = await supabase.auth.getUser();
      // Offline, or the server didn't answer: still signed in, as far as anyone knows.
      if (!alive || error) return;
      if (!isPermanent(data.user)) {
        // Signed out, or the session ended: the sign-in comes back.
        write(ACCOUNT_KEY, null);
        set({ account: null });
        return;
      }
      set({ account: accountOf(data.user!) });
      await restore(supabase, data.user!.id);
    })();
    return () => {
      alive = false;
    };
  }, []);
}
