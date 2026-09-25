import { ApiError, upstreamError } from './errors';

export type VideoDetails = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  channel: string;
  publishedAt: string;
  durationSeconds: number | null;
  thumbnail: string | null;
};

/** Title, description, tags and length of a public video: one `videos.list` call, 1 quota unit. */
export async function getVideo(id: string, key: string): Promise<VideoDetails> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('id', id);
  const res = await fetch(url, { headers: { 'X-Goog-Api-Key': key }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw await upstreamError('youtube', res);

  const body = (await res.json()) as { items?: YouTubeVideo[] };
  const item = body.items?.[0];
  // Private, deleted and region-blocked videos come back as an empty list, not an error.
  if (!item) {
    throw new ApiError(404, 'video_unavailable', 'We can’t open this video. It may be private or deleted.');
  }
  const s = item.snippet;
  const thumbs = s.thumbnails ?? {};
  return {
    id,
    title: s.title ?? '',
    description: s.description ?? '',
    tags: s.tags ?? [],
    channel: s.channelTitle ?? '',
    publishedAt: s.publishedAt ?? '',
    durationSeconds: parseDuration(item.contentDetails?.duration),
    thumbnail: (thumbs.maxres ?? thumbs.high ?? thumbs.medium ?? thumbs.default)?.url ?? null,
  };
}

type Thumb = { url: string };
type YouTubeVideo = {
  snippet: {
    title?: string;
    description?: string;
    tags?: string[];
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: { default?: Thumb; medium?: Thumb; high?: Thumb; maxres?: Thumb };
  };
  contentDetails?: { duration?: string };
};

/** ISO 8601 durations as YouTube writes them: PT1M42S, PT1H2M, P0D for live streams. */
function parseDuration(iso?: string): number | null {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}
