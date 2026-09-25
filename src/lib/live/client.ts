import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { sessionStorage } from './storage';

// The shared backend. Both values are public by design (row level security keeps trips private to
// their members); they're written to .env.local by `eas integrations:supabase:connect`. Without
// them the app runs exactly as before: trips stay on the phone and the group is the scripted demo.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { storage: sessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

export const liveEnabled = !!supabase;

/**
 * The signed-in user's id, signing in anonymously the first time. No email or password: each phone
 * or browser is its own person, and the session is kept so it stays the same person tomorrow.
 */
export async function ensureUser(): Promise<string> {
  if (!supabase) throw new Error('Live trips need the Supabase keys in .env.local');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signedIn.user) throw error ?? new Error('Could not sign in');
  return signedIn.user.id;
}
