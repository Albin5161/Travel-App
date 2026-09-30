import { caller } from '@/server/auth';
import { readJson, respond } from '@/server/errors';
import { sights } from '@/server/pipeline';

/** POST {region}: a city's best-known spots, for a video of it that named no places. */
export async function POST(request: Request) {
  return respond('sights', async (log) => {
    const who = await caller(request, log);
    return sights(await readJson<{ region?: unknown }>(request), who);
  });
}
