import { caller } from '@/server/auth';
import { readJson, respond } from '@/server/errors';
import { cityNotes } from '@/server/pipeline';
import type { CityNotesRequest } from '@/server/types';

/** POST {name, state, near}: a real city's notes for travellers, from Wikipedia and Wikivoyage. */
export async function POST(request: Request) {
  return respond('city', async (log) => {
    const who = await caller(request, log);
    return cityNotes(await readJson<Partial<CityNotesRequest>>(request), who);
  });
}
