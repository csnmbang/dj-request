// Shared helpers for the serverless functions in /api.
// Files starting with "_" are not deployed as routes by Vercel.
import { timingSafeEqual } from 'node:crypto';

export const LIMITS = { ig: 40, title: 200, channel: 120, message: 280, query: 100 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function env(name) {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `Server is missing ${name}`);
  return v;
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Wraps a handler so thrown HttpErrors become JSON responses.
export function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      send(res, status, { error: e instanceof HttpError ? e.message : 'Server error' });
    }
  };
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new HttpError(413, 'Body too large');
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new HttpError(400, 'Invalid JSON'); }
}

// Constant-time PIN comparison, so response timing doesn't leak digits.
export function pinMatches(given) {
  const expected = Buffer.from(env('DJ_PIN'));
  const actual = Buffer.from(String(given ?? ''));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function cleanText(value, max, { required = false, field = 'field' } = {}) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw new HttpError(400, `${field} is required`);
  if (s.length > max) throw new HttpError(400, `${field} is too long (max ${max})`);
  return s || null;
}

export const isUuid = (s) => typeof s === 'string' && UUID.test(s);
export const isVideoId = (s) => typeof s === 'string' && VIDEO_ID.test(s);

// Minimal PostgREST client using the service role key. The key never leaves
// the server; the browser only ever has the read-only anon key.
export async function db(path, { method = 'GET', body } = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    console.error('Supabase error', r.status, text);
    throw new HttpError(502, 'Database error');
  }
  return text ? JSON.parse(text) : null;
}
