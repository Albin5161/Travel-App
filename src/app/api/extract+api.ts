import { readJson, respond } from '@/server/errors';
import { extract } from '@/server/pipeline';

/** POST {url}: reads a YouTube link and lists the places in it; Instagram links come back as `assist`. */
export async function POST(request: Request) {
  return respond(async () => extract((await readJson<{ url?: unknown }>(request)).url));
}
