import { caller } from '@/server/auth';
import { readJson, respond } from '@/server/errors';
import { feedback } from '@/server/pipeline';
import type { FeedbackRequest } from '@/server/types';

/** POST {videoId, placeName, placeId, verdict}: a Right / Wrong / added answer from the review screen. */
export async function POST(request: Request) {
  return respond(async () => {
    const who = await caller(request);
    return feedback(await readJson<Partial<FeedbackRequest>>(request), who);
  });
}
