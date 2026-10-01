import * as supabase from '@supabase/supabase-js';

// On a phone the library comes with the app: there's no download to save, and fetching it on demand
// fails in development. The package keeps index.cjs (phones) and index.mjs (browsers) side by side;
// the app asks for the first by its number, the dev server answers the request for "index" with the
// second, and the piece asked for never arrives ("Requiring unknown module").
export const loadSupabase = () => Promise.resolve(supabase);
