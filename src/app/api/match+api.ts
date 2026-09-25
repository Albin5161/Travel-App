import { caller } from '@/server/auth';
import { readJson, respond } from '@/server/errors';
import { match } from '@/server/pipeline';
import type { MatchRequest } from '@/server/types';

/** POST {name, area, region, confidence}: one place name, matched to a real place with coordinates. */
export async function POST(request: Request) {
  return respond(async () => {
    const who = await caller(request);
    return match(await readJson<Partial<MatchRequest>>(request), who);
  });
}
