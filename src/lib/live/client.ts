import type { SupabaseClient } from '@supabase/supabase-js';

import { sessionStorage } from './storage';

// The shared backend. Both values are public by design (row level security keeps trips private to
// their members); they're written to .env.local by `eas integrations:supabase:connect`. Without
// them the app runs exactly as before: trips stay on the phone and the group is the scripted demo.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const liveEnabled = !!(url && key);

// The client library is a fifth of the app's code, and nothing on the first screen needs it: it's
// fetched the first time something does (reading a link, sharing, joining), then kept.
let client: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  client ??=
    url && key
      ? import('@supabase/supabase-js').then(({ createClient }) =>
          createClient(url, key, {
            auth: { storage: sessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
          }),
        )
      : Promise.resolve(null);
  return client;
}

/**
 * The signed-in user's id, signing in anonymously the first time. No email or password: each phone
 * or browser is its own person, and the session is kept so it stays the same person tomorrow.
 */
export async function ensureUser(): Promise<string> {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Live trips need the Supabase keys in .env.local');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signedIn.user) throw error ?? new Error('Could not sign in');
  return signedIn.user.id;
}
