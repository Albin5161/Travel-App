import { env } from '@/server/env';

/** Which keys the server can see (yes or no, never the values), so setup problems show up before a test run. */
export function GET() {
  const has = (name: string) => !!process.env[name];
  return Response.json({
    ok: true,
    keys: {
      youtube: has('YOUTUBE_API_KEY') || has('GOOGLE_API_KEY'),
      places: has('PLACES_API_KEY') || has('GOOGLE_API_KEY'),
      gemini: has('GEMINI_API_KEY'),
    },
    model: env.geminiModel(),
    placesPhotos: env.placesPhotos(),
  });
}
