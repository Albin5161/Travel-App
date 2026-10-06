/// <reference types="node" />
// Asks the real model for its facts about the test places, once, and keeps the answers in
// gemini-facts.json, so the planner's tests and the before/after print-out use what Gemini actually
// says rather than what we hope it says. Six small calls on the free tier:
//   npm run planner:record-facts
// The key is read from .env.local and never printed.
import { writeFileSync } from 'node:fs';

import { findPlaces } from '@/server/gemini';

import { foodHeavy, gokarna, kochi, ladakh, mumbai, sparse } from './fixtures';

process.loadEnvFile('.env.local');
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY is not set in .env.local');
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const fallback = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash';

const trips = { Gokarna: gokarna, Kochi: kochi, Ladakh: ladakh, Mumbai: mumbai, 'Old Delhi': foodHeavy, 'Central Kerala': sparse };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const out: Record<string, unknown> = {};

for (const [city, places] of Object.entries(trips)) {
  // Written the way a video's description lists its stops: a name, and a line about it.
  const description = `Everywhere we went in ${city}:\n` + places.map((p, i) => `${i + 1}. ${p.name}${p.area ? ` (${p.area})` : ''}: ${p.why}`).join('\n');
  const got = await findPlaces(
    { kind: 'youtube', video: { id: 'test', title: `${city} travel guide: the places worth your time`, description, tags: [city, 'travel'], channel: 'Test', publishedAt: '', durationSeconds: 600, thumbnail: null } },
    key,
    model,
    fallback,
  );
  console.log(`${city}: asked about ${places.length}, got ${got.places.length} back (${got.usage.model}, ${got.usage.inputTokens} in / ${got.usage.outputTokens} out)`);
  for (const p of places) {
    const hit = got.places.find((g) => norm(g.name) === norm(p.name)) ?? got.places.find((g) => norm(g.name).includes(norm(p.name).split(' ')[0]) && norm(p.name).includes(norm(g.name).split(' ')[0]));
    if (!hit) {
      console.log(`  no answer for ${p.name}`);
      continue;
    }
    out[`${city}: ${p.name}`] = {
      type: hit.type,
      area: hit.area,
      parentArea: hit.parentArea,
      visitMinutes: hit.visitMinutes,
      window: hit.window,
      mealType: hit.mealType,
      sunsetRelevant: hit.sunsetRelevant,
      sunriseRelevant: hit.sunriseRelevant,
      nightRelevant: hit.nightRelevant,
      confidence: hit.confidence,
    };
  }
}
writeFileSync(new URL('./gemini-facts.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`Saved facts for ${Object.keys(out).length} places.`);
