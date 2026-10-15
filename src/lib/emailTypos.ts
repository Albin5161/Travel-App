/**
 * Catches a slip in an email's provider ("gmial.com", "gmail.con", "yaho.com") and suggests the
 * address it was probably meant to be, as most sign-ups do. A slip there means the code never
 * arrives and the person is stuck. Only suggests: an unusual address that's right still goes.
 */
const DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'rediffmail.com',
  'protonmail.com',
  'proton.me',
  'aol.com',
  'zoho.com',
];

/** How many single-letter changes (add, drop, swap, replace) turn one word into the other. */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      // Two letters the wrong way round ("gmial") count as one slip.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** The address with its provider corrected, or null when it looks right (or isn't close to any). */
export function suggestEmail(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  if (at < 1) return null;
  const local = email.trim().slice(0, at);
  const domain = email.trim().toLowerCase().slice(at + 1);
  if (domain.length < 4 || DOMAINS.includes(domain)) return null;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const known of DOMAINS) {
    const d = distance(domain, known);
    if (d < bestDistance) {
      best = known;
      bestDistance = d;
    }
  }
  // One or two slips; a short provider ("me.com") only one, or every 6-letter domain would match.
  const allowed = (best?.length ?? 0) <= 6 ? 1 : 2;
  return best && bestDistance <= allowed ? `${local}@${best}` : null;
}
