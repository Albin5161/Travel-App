import { caller } from '@/server/auth';
import { readJson, respond } from '@/server/errors';
import { parseLink } from '@/server/links';
import { extract } from '@/server/pipeline';

/** POST {url}: reads a YouTube or Instagram link and lists the places in it; Instagram falls back to `assist`. */
export async function POST(request: Request) {
  return respond('extract', async (log) => {
    const who = await caller(request, log);
    const { url } = await readJson<{ url?: unknown }>(request);
    // The video's ID for the log line, never the link: yt:ID or ig:shortcode.
    const link = typeof url === 'string' ? parseLink(url) : null;
    if (link) log.video = link.platform === 'youtube' ? `yt:${link.videoId}` : `ig:${link.shortcode}`;
    return extract(url, who);
  });
}
