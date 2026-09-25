export type ParsedLink =
  | { platform: 'youtube'; videoId: string }
  | { platform: 'instagram'; shortcode: string; url: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * A pasted link, reduced to what identifies the video. Accepts the shapes people actually copy:
 * watch?v=, youtu.be, Shorts, embeds and live links on YouTube; reels, posts and /tv on Instagram,
 * with or without the scheme, www or m. Anything else is null.
 */
export function parseLink(input: string): ParsedLink | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');

  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1] ?? '';
    return VIDEO_ID.test(id) ? { platform: 'youtube', videoId: id } : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v && VIDEO_ID.test(v)) return { platform: 'youtube', videoId: v };
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:[/?]|$)/);
    return m ? { platform: 'youtube', videoId: m[1] } : null;
  }
  if (host === 'instagram.com' || host === 'instagr.am') {
    // /reel/X, /reels/X, /p/X, /tv/X, and the /username/reel/X form some shares use.
    const m = url.pathname.match(/^\/(?:[^/]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/);
    return m ? { platform: 'instagram', shortcode: m[1], url: `https://www.instagram.com/reel/${m[1]}/` } : null;
  }
  return null;
}
