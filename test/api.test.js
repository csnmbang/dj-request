// Tests for the /api functions. Supabase, YouTube and ntfy are faked by
// replacing global fetch, so these run offline with no keys.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import dj from '../api/dj.js';
import request from '../api/request.js';
import search from '../api/search.js';

let calls;
let dbRows;

beforeEach(() => {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    YOUTUBE_API_KEY: 'yt-key', DJ_PIN: 'correct-pin', NTFY_TOPIC: 'topic',
  });
  calls = [];
  dbRows = { settings: [{ is_accepting: true }] };
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), ...opts });
    const u = String(url);
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (u.startsWith('https://www.googleapis.com')) {
      return json({ items: [{ id: { videoId: 'dQw4w9WgXcQ' }, snippet: { title: 'Song', channelTitle: 'Ch', thumbnails: { default: { url: 't.jpg' } } } }] });
    }
    if (u.startsWith('https://ntfy.sh')) return new Response('');
    if (u.includes('/event_settings?id=eq.1&select')) return json(dbRows.settings);
    if (u.includes('/requests?status=eq.pending&select=id')) return json([{ id: 1 }, { id: 2 }]);
    if (u.endsWith('/rest/v1/requests') && opts.method === 'POST') return json([{ id: 'new', queue_position: 2 }], 201);
    return json([{}]);
  };
});

function call(fn, { method = 'POST', url = '/', body } = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, { method, url });
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
      end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    fn(req, res);
  });
}

const dbWrites = () => calls.filter((c) => c.url.startsWith('https://db.test') && c.method && c.method !== 'GET');

test('dj: wrong PIN is rejected and nothing is written', async () => {
  const r = await call(dj, { body: { pin: '2606', action: 'clear_all' } });
  assert.equal(r.status, 401);
  assert.equal(dbWrites().length, 0);
});

test('dj: missing PIN is rejected', async () => {
  const r = await call(dj, { body: { action: 'clear_all' } });
  assert.equal(r.status, 401);
});

test('dj: correct PIN runs the action with the service key', async () => {
  const r = await call(dj, { body: { pin: 'correct-pin', action: 'clear_all' } });
  assert.equal(r.status, 200);
  const [w] = dbWrites();
  assert.equal(w.method, 'PATCH');
  assert.equal(w.headers.Authorization, 'Bearer service-key');
});

test('dj: rejects ids that are not UUIDs (no PostgREST filter injection)', async () => {
  const r = await call(dj, { body: { pin: 'correct-pin', action: 'played', id: '1&status=neq.x' } });
  assert.equal(r.status, 400);
  assert.equal(dbWrites().length, 0);
});

test('dj: unknown action is rejected', async () => {
  const r = await call(dj, { body: { pin: 'correct-pin', action: 'drop_tables' } });
  assert.equal(r.status, 400);
});

test('dj: GET is not allowed', async () => {
  assert.equal((await call(dj, { method: 'GET' })).status, 405);
});

test('request: valid YouTube request is inserted and the DJ is pinged', async () => {
  const r = await call(request, { body: { ig: '@fan', title: 'Song', source: 'yt', videoId: 'dQw4w9WgXcQ' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.position, 2);
  const insert = calls.find((c) => c.method === 'POST' && c.url.endsWith('/requests'));
  const row = JSON.parse(insert.body);
  assert.equal(row.ig_handle, 'fan');
  assert.equal(row.thumb_url, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg');
  assert.ok(calls.some((c) => c.url === 'https://ntfy.sh/topic'));
});

test('request: refuses when the DJ has paused requests', async () => {
  dbRows.settings = [{ is_accepting: false }];
  const r = await call(request, { body: { title: 'Song', source: 'txt' } });
  assert.equal(r.status, 409);
});

test('request: refuses oversized fields and bad video ids', async () => {
  assert.equal((await call(request, { body: { title: 'x'.repeat(201), source: 'txt' } })).status, 400);
  assert.equal((await call(request, { body: { title: 'Song', source: 'yt', videoId: '"><script>' } })).status, 400);
  assert.equal((await call(request, { body: { source: 'txt' } })).status, 400);
});

test('search: proxies YouTube without exposing the key', async () => {
  const r = await call(search, { method: 'GET', url: '/api/search?q=daft+punk' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.items[0], { videoId: 'dQw4w9WgXcQ', title: 'Song', channel: 'Ch', thumb: 't.jpg' });
  assert.ok(!JSON.stringify(r.body).includes('yt-key'));
});

test('search: rejects too-short queries before spending quota', async () => {
  const r = await call(search, { method: 'GET', url: '/api/search?q=ab' });
  assert.equal(r.status, 400);
  assert.equal(calls.length, 0);
});

test('missing server config fails loudly', async () => {
  delete process.env.DJ_PIN;
  const r = await call(dj, { body: { pin: 'x', action: 'login' } });
  assert.equal(r.status, 500);
  assert.match(r.body.error, /DJ_PIN/);
});
