// How a Gemini read falls back when the main model is busy, slow or unreachable. Gemini itself is
// never called: fetch is replaced by a script of answers, one per try, in order.

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { ApiError } from '@/server/errors';
import { generate } from '@/server/gemini';

const MAIN = 'main-model';
const FALLBACK = 'fallback-model';

type Step = number | 'timeout' | 'offline' | 'call-limit';

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realError = console.error;
afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  console.error = realError;
});

/** Plays `steps` back as Gemini's answers and records which model each try asked. */
function script(steps: Step[]) {
  const asked: string[] = [];
  const waits: boolean[] = [];
  console.warn = () => {};
  console.error = () => {};
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    asked.push(decodeURIComponent(url.split('/models/')[1].split(':')[0]));
    waits.push(init?.signal instanceof AbortSignal);
    const step = steps[asked.length - 1];
    if (step === undefined) throw new Error('more tries than scripted');
    if (step === 'timeout') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    if (step === 'offline') throw new TypeError('fetch failed');
    if (step === 'call-limit') throw new Error('Too many subrequests by single Worker invocation.');
    if (step === 200) {
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 } });
    }
    return new Response('busy', { status: step });
  }) as typeof fetch;
  return { asked, waits };
}

const read = () => generate('system', 'text', {}, 'key', MAIN, FALLBACK);

test('an answer first time is one call', async () => {
  const { asked } = script([200]);
  const out = await read();
  assert.deepEqual(asked, [MAIN]);
  assert.deepEqual(out.parsed, { ok: true });
  assert.equal(out.usage.model, MAIN);
});

test('no answer in time: straight to the other model, not the same one again', async () => {
  const { asked, waits } = script(['timeout', 200]);
  const out = await read();
  assert.deepEqual(asked, [MAIN, FALLBACK]);
  assert.equal(out.usage.model, FALLBACK);
  assert.ok(waits.every(Boolean), 'every try has a time limit');
});

test('a dropped connection: straight to the other model', async () => {
  const { asked } = script(['offline', 200]);
  const out = await read();
  assert.deepEqual(asked, [MAIN, FALLBACK]);
  assert.equal(out.usage.model, FALLBACK);
});

test('502 and 504 count as busy: the same model again, then the other', async () => {
  let s = script([502, 200]);
  await read();
  assert.deepEqual(s.asked, [MAIN, MAIN]);
  s = script([504, 504, 200]);
  const out = await read();
  assert.deepEqual(s.asked, [MAIN, MAIN, FALLBACK]);
  assert.equal(out.usage.model, FALLBACK);
});

test('busy, then slow: the other model still gets its turn', async () => {
  const { asked } = script([503, 'timeout', 200]);
  const out = await read();
  assert.deepEqual(asked, [MAIN, MAIN, FALLBACK]);
  assert.equal(out.usage.model, FALLBACK);
});

test('never more than three calls, and a clear error when all are busy', async () => {
  const { asked } = script([503, 503, 503]);
  await assert.rejects(read(), (e) => e instanceof ApiError && e.code === 'upstream');
  assert.equal(asked.length, 3);
});

test('both models out of time: the timeout comes back as before, after two calls', async () => {
  const { asked } = script(['timeout', 'timeout']);
  await assert.rejects(read(), (e) => e instanceof DOMException && e.name === 'TimeoutError');
  assert.deepEqual(asked, [MAIN, FALLBACK]);
});

test('the hosting’s call limit is not retried', async () => {
  const { asked } = script(['call-limit']);
  await assert.rejects(read(), /subrequests/);
  assert.equal(asked.length, 1);
});

test('a refusal that asking again won’t fix (a bad request, a bad key) is one call', async () => {
  for (const status of [400, 403]) {
    const { asked } = script([status]);
    await assert.rejects(read(), (e) => e instanceof ApiError);
    assert.equal(asked.length, 1, `HTTP ${status}`);
  }
});

test('without a fallback model, a timeout has nowhere to go', async () => {
  const { asked } = script(['timeout']);
  await assert.rejects(generate('system', 'text', {}, 'key', MAIN), (e) => e instanceof DOMException && e.name === 'TimeoutError');
  assert.deepEqual(asked, [MAIN]);
});
