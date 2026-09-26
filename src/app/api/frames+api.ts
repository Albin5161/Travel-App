import { caller } from '@/server/auth';
import { readJson, respond } from '@/server/errors';
import { frames } from '@/server/pipeline';

/** POST {videoId}: three frames from a YouTube video, for places saved before frames came with them. */
export async function POST(request: Request) {
  return respond(async () => {
    await caller(request);
    return frames(await readJson<{ videoId?: unknown }>(request));
  });
}
