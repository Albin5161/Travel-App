import { env } from '@/server/env';
import { db } from '@/server/supabase';

/**
 * Whether the server is set up (yes or no per key, never the values), so setup problems show up
 * before a test run. `protected` false means anyone can call the API: fine on your Mac only.
 */
export function GET() {
  const has = (name: string) => !!process.env[name];
  return Response.json({
    ok: true,
    keys: {
      youtube: has('YOUTUBE_API_KEY') || has('GOOGLE_API_KEY'),
      places: has('PLACES_API_KEY') || has('GOOGLE_API_KEY'),
      gemini: has('GEMINI_API_KEY'),
    },
    protected: !!db(),
    model: env.geminiModel(),
    placesPhotos: env.placesPhotos(),
  });
}
