import { ensureUser, supabase } from '@/lib/live/client';

// Talks to our own API routes (src/app/api). In development a relative path reaches the dev server;
// a build points at the deployed server with EXPO_PUBLIC_API_URL. EXPO_PUBLIC_API_FALLBACK_URL is a
// second deployment tried when the first can't be reached or fails on its side, never for answers
// like "not a link" or "today's limit", which the second would give too.
const BASES = [process.env.EXPO_PUBLIC_API_URL ?? '', process.env.EXPO_PUBLIC_API_FALLBACK_URL].filter(
  (b, i, all): b is string => b !== undefined && all.indexOf(b) === i,
);

/** A failure the app can show as is: `message` is written for people. */
export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** Worth trying again: the network or our server, not the request. */
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

const OFFLINE = new ApiFailure('offline', 'We can’t reach Xplore right now. Check your connection and try again.', true);

// The server's own errors from its side (upstream, 5xx) are worth one try elsewhere; its answers
// about the request itself are final.
const TRY_ELSEWHERE = new Set(['upstream', 'not_configured', 'missing_key']);

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  await ensureUser();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** POST a JSON body to an API route and return its JSON, trying the fallback server if needed. */
export async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  let headers: Record<string, string>;
  try {
    headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  } catch {
    throw OFFLINE;
  }
  let last: ApiFailure = OFFLINE;
  for (const base of BASES) {
    // A plain timer rather than AbortSignal.timeout, which not every React Native runtime has.
    const abort = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, timeoutMs);
    let res: Response;
    let json: { error?: { code: string; message: string } } | null;
    try {
      res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: abort.signal });
      json = await res.json().catch(() => null);
    } catch {
      last = timedOut ? new ApiFailure('timeout', 'That took too long. Try again.', true) : OFFLINE;
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (res.ok && json && !json.error) return json as T;
    const code = json?.error?.code ?? 'upstream';
    last = new ApiFailure(code, json?.error?.message ?? 'Something went wrong on our side. Try again.', TRY_ELSEWHERE.has(code));
    if (!TRY_ELSEWHERE.has(code) && res.status < 500) break;
    if (code === 'quota') break;
  }
  throw last;
}
