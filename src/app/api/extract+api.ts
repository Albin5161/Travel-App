import { caller } from '@/server/auth';
import { readJson, respond } from '@/server/errors';
import { extract } from '@/server/pipeline';

/** POST {url}: reads a YouTube or Instagram link and lists the places in it; Instagram falls back to `assist`. */
export async function POST(request: Request) {
  return respond(async () => {
    const who = await caller(request);
    return extract((await readJson<{ url?: unknown }>(request)).url, who);
  });
}
