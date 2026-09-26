import { ApiError } from './errors';

// Server-only keys, read from .env.local in development. None of them is EXPO_PUBLIC_, so none
// ever reaches the app bundle. One Google Cloud key can serve both YouTube and Places.
function need(name: string, fallback?: string): string {
  const value = process.env[name] || (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new ApiError(500, 'missing_key', `The API needs ${name}${fallback ? ` (or ${fallback})` : ''} in .env.local.`);
  }
  return value;
}

export const env = {
  youtubeKey: () => need('YOUTUBE_API_KEY', 'GOOGLE_API_KEY'),
  placesKey: () => need('PLACES_API_KEY', 'GOOGLE_API_KEY'),
  geminiKey: () => need('GEMINI_API_KEY'),
  /**
   * Flash-Lite by default: in the first 12-video test it found the places well, and Flash was
   * too busy to answer on the free tier. Both are free; GEMINI_MODEL=gemini-3.8-flash to compare.
   */
  geminiModel: () => process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  /** Used when the main model is busy or rate-limited. Also free. */
  geminiFallback: () => process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash',
  /** Google photos draw on a free allowance of 1,000 a month; PLACES_PHOTOS=off saves it. */
  placesPhotos: () => process.env.PLACES_PHOTOS !== 'off',
  /** Apify, for reading Instagram reels. Optional: without it, Instagram links go straight to search. */
  apifyToken: () => process.env.APIFY_TOKEN || null,
  /** A reel's spoken words, fetched when its text names nothing. INSTAGRAM_TRANSCRIPTS=off skips it. */
  instagramTranscripts: () => process.env.INSTAGRAM_TRANSCRIPTS !== 'off',
  /** The same project the app uses. The URL is public; the secret key is server-only. */
  supabaseUrl: () => process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || null,
  supabaseSecret: () => process.env.SUPABASE_SECRET_KEY || null,
  production: () => process.env.NODE_ENV === 'production',
};

/** A limit from the environment, or its default. */
export function limit(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
