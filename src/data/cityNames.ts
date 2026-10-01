// One city, one name. A city's name arrives as free text (the model's reading of a video, or a
// Google address), and the same city comes under several: "New Delhi" and "Delhi", "Bangalore" and
// "Bengaluru". Each is filed under the one name the app uses, so two videos of one city land in one
// collection instead of two.

/** The name the app uses, then the other names the same city goes by (lower case). */
const OTHER_NAMES: Record<string, string[]> = {
  Delhi: ['new delhi', 'old delhi', 'delhi ncr', 'nct of delhi', 'national capital territory of delhi'],
  Mumbai: ['bombay'],
  Bengaluru: ['bangalore'],
  Mysuru: ['mysore'],
  Mangaluru: ['mangalore'],
  Coorg: ['kodagu'],
  Chennai: ['madras'],
  Ooty: ['udhagamandalam', 'ootacamund'],
  Puducherry: ['pondicherry', 'pondy'],
  Thanjavur: ['tanjore'],
  Tiruchirappalli: ['trichy', 'tiruchi'],
  Kolkata: ['calcutta'],
  Kochi: ['cochin'],
  Kozhikode: ['calicut'],
  Thiruvananthapuram: ['trivandrum'],
  Alappuzha: ['alleppey'],
  Kollam: ['quilon'],
  Thrissur: ['trichur'],
  Kannur: ['cannanore'],
  Palakkad: ['palghat'],
  Varanasi: ['banaras', 'benares', 'kashi'],
  Prayagraj: ['allahabad'],
  Gurugram: ['gurgaon'],
  Shimla: ['simla'],
  Vadodara: ['baroda'],
  Panaji: ['panjim'],
  Visakhapatnam: ['vizag', 'vishakhapatnam'],
};

/** Letters and digits only, lower case, single spaces: "New-Delhi " and "new delhi" read the same. */
const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const FILED = new Map<string, string>(
  Object.entries(OTHER_NAMES).flatMap(([name, others]) => [name, ...others].map((n) => [plain(n), name] as [string, string])),
);

/** The name a city is filed under: "New Delhi" is Delhi. A name with no other comes back as it was. */
export function cityName(raw: string): string {
  return FILED.get(plain(raw)) ?? raw.trim();
}

/**
 * Whether two names could be one city's: the same once filed, or one inside the other ("Kochi" and
 * "Fort Kochi", "Goa" and "North Goa"). Only half the answer, since two towns can share a name: the
 * caller also checks they're in the same part of the map.
 */
export function sameCityName(a: string, b: string): boolean {
  const [x, y] = [plain(cityName(a)), plain(cityName(b))];
  if (!x || !y) return false;
  return x === y || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `);
}
