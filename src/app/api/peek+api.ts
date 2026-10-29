import { caller } from '@/server/auth';
import { readJson, respond } from '@/server/errors';
import { peek } from '@/server/pipeline';

/** POST {url}: an Instagram reel's cover picture and poster, quick, while the read itself runs. */
export async function POST(request: Request) {
  return respond('peek', async (log) => {
    await caller(request, log);
    return peek(await readJson<{ url?: unknown }>(request));
  });
}
