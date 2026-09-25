#!/usr/bin/env node
// Runs real videos through the API the way the app will: extract, then match every place in
// parallel. Prints what it found and how long each step took, then a summary.
//
//   node scripts/test-api.mjs                      # the links in scripts/test-videos.txt
//   node scripts/test-api.mjs <link> [<link> ...]  # just these
//   API_BASE=http://localhost:8081 node scripts/test-api.mjs
//   node scripts/test-api.mjs --out results.json   # also save everything as JSON
//
// Videos run one after another, not all at once, to stay under the free tiers' per-minute limits.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = (process.env.API_BASE || 'http://localhost:8081').replace(/\/$/, '');
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const outFile = outAt >= 0 ? args[outAt + 1] : null;
const links = outAt >= 0 ? args.filter((_, i) => i !== outAt && i !== outAt + 1) : args;
const videos = links.length
  ? links
  : readFileSync(join(here, 'test-videos.txt'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

async function post(path, body) {
  const t = performance.now();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: { code: 'not_json', message: `HTTP ${res.status}` } }));
  return { ok: res.ok, status: res.status, json, ms: Math.round(performance.now() - t) };
}

const pct = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

const health = await fetch(`${base}/api/health`)
  .then((r) => r.json())
  .catch(() => null);
if (!health) {
  console.error(`No API at ${base}. Start it with \`npx expo start\`, or set API_BASE.`);
  process.exit(1);
}
const missing = Object.entries(health.keys).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`The server can't see these keys: ${missing.join(', ')}. Add them to .env.local and restart it.`);
  process.exit(1);
}
console.log(`API ${base} · model ${health.model} · Google photos ${health.placesPhotos ? 'on' : 'off'}\n`);

const results = [];
for (const url of videos) {
  const ex = await post('/api/extract', { url });
  if (!ex.ok) {
    console.log(`✗ ${url}\n  ${ex.json.error?.code}: ${ex.json.error?.message}\n`);
    results.push({ url, ok: false, error: ex.json.error });
    continue;
  }
  const r = ex.json;
  if (r.status !== 'done') {
    console.log(`• ${url}\n  ${r.status} (${r.platform})\n`);
    results.push({ url, ok: true, status: r.status });
    continue;
  }

  const t = performance.now();
  const matched = await Promise.all(
    r.places.map((p) => post('/api/match', { name: p.name, area: p.area, region: r.region, confidence: p.confidence })),
  );
  const matchMs = Math.round(performance.now() - t);

  console.log(`${r.video.title}`);
  console.log(
    `  ${r.video.channel} · ${r.region ?? 'no region'} · ${r.places.length} places · ` +
      `YouTube ${r.timings.youtube ?? 0} ms, model ${r.timings.model ?? 0} ms, matching ${matchMs} ms · ` +
      `${r.usage.inputTokens}+${r.usage.outputTokens} tokens${r.cached ? ' · cached' : ''}`,
  );
  r.places.forEach((p, i) => {
    const m = matched[i];
    const mark = !m.ok ? '✗' : m.json.status === 'unmatched' ? '✗' : m.json.needsCheck ? '?' : '✓';
    const where = !m.ok
      ? `error ${m.json.error?.code}`
      : m.json.status === 'matched'
        ? `${m.json.place.address}${m.json.place.photo ? ' · photo' : ''}`
        : 'no match';
    console.log(`  ${mark} ${p.name} [${p.type}${p.area ? `, ${p.area}` : ''}] (${p.confidence.toFixed(2)}) → ${where}`);
  });
  console.log('');

  results.push({
    url,
    ok: true,
    status: 'done',
    title: r.video.title,
    region: r.region,
    cached: r.cached,
    extractMs: ex.ms,
    matchMs,
    totalMs: ex.ms + matchMs,
    tokens: r.usage,
    places: r.places.map((p, i) => ({ ...p, match: matched[i].json })),
  });
}

const done = results.filter((x) => x.status === 'done');
const fresh = done.filter((x) => !x.cached);
const all = done.flatMap((x) => x.places);
const matchedN = all.filter((p) => p.match.status === 'matched').length;
const sure = all.filter((p) => p.match.status === 'matched' && !p.match.needsCheck).length;
const photos = all.filter((p) => p.match.place?.photo).length;
const failed = results.filter((x) => !x.ok).length;
const empty = done.filter((x) => x.places.length === 0).length;

console.log('Summary');
console.log(`  Videos: ${done.length} read, ${empty} with no places, ${failed} failed`);
console.log(
  `  Time to all places (fresh runs): typical ${secs(pct(fresh.map((x) => x.totalMs), 50))}, slowest 5% ${secs(pct(fresh.map((x) => x.totalMs), 95))}`,
);
console.log(`  Places: ${all.length} found, ${matchedN} matched (${all.length ? Math.round((100 * matchedN) / all.length) : 0}%), ${sure} without a check, ${photos} with a Google photo`);
console.log(
  `  Tokens: ${fresh.reduce((n, x) => n + x.tokens.inputTokens, 0)} in, ${fresh.reduce((n, x) => n + x.tokens.outputTokens, 0)} out`,
);
console.log(`  Free allowance used this run: ~${matchedN} Place Details (of 10,000/month), ~${photos} photos (of 1,000/month)`);

if (outFile) {
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nSaved to ${outFile}`);
}
