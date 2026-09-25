import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from './env';

// The server's own client. It uses the secret key, which bypasses row level security, so it can
// write the shared tables the app can't touch. It never leaves the server.
let client: SupabaseClient | null | undefined;

// createClient always builds a realtime client, and on Node 20 (no built-in WebSocket) that throws.
// The server never opens a realtime channel, so a stand-in is enough; EAS Hosting and Node 22
// have a real WebSocket and use it.
class NoRealtime {
  constructor() {
    throw new Error('The API server does not use realtime.');
  }
}

export function db(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = env.supabaseUrl();
  const secret = env.supabaseSecret();
  client =
    url && secret
      ? createClient(url, secret, {
          auth: { persistSession: false, autoRefreshToken: false },
          realtime: {
            transport: ((globalThis as { WebSocket?: unknown }).WebSocket ?? NoRealtime) as never,
          },
        })
      : null;
  return client;
}
