// One line per API request, readable in the EAS Hosting dashboard (Deployments > a deployment >
// Logs), so a failed paste can be traced after the fact. What goes in: the route, the outcome, how
// long it took and each step, the install's anonymous ID (8 characters of its anonymous sign-in),
// and the video's ID. What stays out: links, names, IP addresses, anything typed.
//
//   [api] extract 200 · 8.4 s · user 3fa9c1d2 · ig:DAbc12xYz · assist: unreadable · 0 places · apify 7.9 s, store 0.1 s

/** What a route adds to its line as it learns it. */
export type RequestLog = { user?: string; video?: string };

/** The first 8 characters of an install's anonymous sign-in: enough to follow one person's requests. */
export const shortUser = (userId: string) => userId.replace(/-/g, '').slice(0, 8);

const seconds = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/** Reads the outcome off a route's answer: its status, why it fell back, how many places, the steps. */
function outcome(result: unknown): string[] {
  if (!result || typeof result !== 'object') return [];
  const r = result as {
    status?: unknown;
    reason?: unknown;
    places?: unknown;
    suggestions?: unknown;
    cached?: unknown;
    timings?: Record<string, number>;
  };
  const parts: string[] = [];
  if (typeof r.status === 'string') parts.push(typeof r.reason === 'string' ? `${r.status}: ${r.reason}` : r.status);
  if (Array.isArray(r.places)) parts.push(`${r.places.length} ${r.places.length === 1 ? 'place' : 'places'}`);
  if (Array.isArray(r.suggestions)) parts.push(`${r.suggestions.length} suggestions`);
  if (r.cached === true) parts.push('from storage');
  const steps = Object.entries(r.timings ?? {}).filter(([name]) => name !== 'total');
  if (steps.length) parts.push(steps.map(([name, ms]) => `${name} ${seconds(ms)}`).join(', '));
  return parts;
}

export function writeLog(route: string, startedAt: number, httpStatus: number, log: RequestLog, result?: unknown, error?: string) {
  const line = [
    `[api] ${route} ${httpStatus}`,
    seconds(Date.now() - startedAt),
    log.user ? `user ${log.user}` : null,
    log.video ?? null,
    error ? `error: ${error}` : null,
    ...outcome(result),
  ]
    .filter(Boolean)
    .join(' · ');
  const fellBack = !!result && typeof result === 'object' && (result as { status?: unknown }).status === 'assist';
  if (httpStatus >= 500) console.error(line);
  else if (httpStatus >= 400 || fellBack) console.warn(line);
  else console.log(line);
}
