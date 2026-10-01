// The Supabase client library, fetched when something first needs it: it's a fifth of the web app's
// code and nothing on the first screen uses it. The phone apps take it from library.native.ts.
export const loadSupabase = () => import('@supabase/supabase-js');
