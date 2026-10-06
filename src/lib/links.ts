import { detectPlatform } from '@/data/api';
import { parseLink } from '@/server/links';

// Finding video links in whatever was pasted or shared: one link, several on their own lines, or a
// forwarded message with words around them ("Check this reel https://www.instagram.com/reel/…").

/** An Instagram or YouTube link in a piece of text, with or without https:// and www. */
const LINK = /(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am|youtube\.com|youtu\.be)\/[^\s<>"]+/gi;

/** The most links read from one paste: each costs a real read, and a wall of text shouldn't spend the day's allowance. */
export const LINKS_AT_ONCE = 5;

/** What makes two links the same video, however each was copied: "yt:<id>" or "ig:<shortcode>". */
export function linkKey(url: string): string {
  const link = parseLink(url);
  if (!link) return url.trim();
  return link.platform === 'youtube' ? `yt:${link.videoId}` : `ig:${link.shortcode}`;
}

/** Every video link in `text`, in order, each video once. */
export function linksIn(text: string): string[] {
  // Two links pasted one straight after the other arrive joined; a space parts them again.
  const spaced = text.replace(/(\S)(https?:\/\/)/gi, '$1 $2');
  const seen = new Set<string>();
  return (spaced.match(LINK) ?? []).filter((url) => {
    if (!detectPlatform(url)) return false;
    const key = linkKey(url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
