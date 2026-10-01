import { limit } from './env';

// The hosting plan decides how many outgoing calls ("subrequests": Google, Wikimedia, the database)
// one request may make. On EAS Hosting's free plan that's 10, and the 11th fails the request. So a
// request plans what it spends: the steps it can't do without first, the nice-to-haves (a photo)
// only with what's left. On a paid plan (10,000), set HOST_CALLS_PER_REQUEST and the planning
// stops mattering.
export const hostCalls = () => limit('HOST_CALLS_PER_REQUEST', 10);

/** What a request has left to spend. One call is held back: checking who's calling can need it. */
export type Calls = { left: number };
export const callsForRequest = (): Calls => ({ left: hostCalls() - 1 });

/** Spends `n` calls if there are that many left; says whether it could. */
export function take(calls: Calls, n = 1): boolean {
  if (calls.left < n) return false;
  calls.left -= n;
  return true;
}
