import { env } from './env';
import { ApiError } from './errors';
import { db } from './supabase';

export type Caller = { userId: string; ip: string };

let warned = false;

/**
 * Who is calling. The app signs every install in to Supabase anonymously (see src/lib/live) and
 * sends that session's access token. getClaims checks the token's signature against the project's
 * published keys, so a forged or expired token is refused without a round trip per request.
 *
 * Without Supabase configured, development runs open (one warning); production refuses to.
 */
export async function caller(request: Request): Promise<Caller> {
  const ip = clientIp(request);
  const supabase = db();
  if (!supabase) {
    if (env.production()) {
      throw new ApiError(500, 'not_configured', 'The API isn’t set up to check who’s calling.');
    }
    if (!warned) {
      warned = true;
      console.warn('[auth] SUPABASE_SECRET_KEY not set: the API is open. Fine on your Mac, never in production.');
    }
    return { userId: 'dev', ip };
  }

  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new ApiError(401, 'unauthorized', 'Sign in to use this.');
  const { data, error } = await supabase.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || typeof sub !== 'string') throw new ApiError(401, 'unauthorized', 'Your session has expired. Try again.');
  return { userId: sub, ip };
}

/** The caller's network address: Cloudflare's header on EAS Hosting, the proxy chain elsewhere. */
function clientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'local';
}
