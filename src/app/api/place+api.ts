import { caller } from '@/server/auth';
import { readJson, respond } from '@/server/errors';
import { placeInfo } from '@/server/pipeline';

/** POST {placeId}: Google's rating, hours and reviews for one place's page. */
export async function POST(request: Request) {
  return respond(async () => {
    const who = await caller(request);
    return placeInfo(await readJson<{ placeId?: unknown }>(request), who);
  });
}
