import { caller } from '@/server/auth';
import { readJson, respond } from '@/server/errors';
import { search } from '@/server/pipeline';
import type { SearchRequest } from '@/server/types';

/** POST {input, sessionToken, near}: places matching what someone is typing in "Missed one?". */
export async function POST(request: Request) {
  return respond('search', async (log) => {
    const who = await caller(request, log);
    return search(await readJson<Partial<SearchRequest>>(request), who);
  });
}
