// POST /api/dj -> every DJ Booth action. The PIN is checked here, on the
// server, on every call; the browser can't skip it.
import { handler, send, readJson, pinMatches, isUuid, cleanText, db, HttpError } from './_lib.js';

const ACTIONS = {
  // Just checks the PIN, so the booth can unlock.
  login: async () => ({ ok: true }),

  play: async ({ id }) => {
    requireId(id);
    await db('requests?status=eq.playing', { method: 'PATCH', body: { status: 'pending' } });
    await db(`requests?id=eq.${id}`, { method: 'PATCH', body: { status: 'playing' } });
    return { ok: true };
  },

  played: async ({ id }) => {
    requireId(id);
    await db(`requests?id=eq.${id}`, { method: 'PATCH', body: { status: 'played' } });
    return { ok: true };
  },

  clear_played: async () => {
    await db('requests?status=eq.played', { method: 'PATCH', body: { status: 'deleted' } });
    return { ok: true };
  },

  clear_all: async () => {
    await db('requests?status=neq.deleted', { method: 'PATCH', body: { status: 'deleted' } });
    return { ok: true };
  },

  save_settings: async ({ settings = {} }) => {
    const avg = Number.parseInt(settings.avg_song_minutes, 10);
    const body = {
      event_name: cleanText(settings.event_name, 60, { field: 'Event name' }) ?? 'LIVE',
      venue_name: cleanText(settings.venue_name, 60, { field: 'Venue' }) ?? '',
      event_date: cleanText(settings.event_date, 30, { field: 'Date' }) ?? '',
      avg_song_minutes: Number.isFinite(avg) && avg >= 1 && avg <= 15 ? avg : 3,
      is_accepting: settings.is_accepting !== false,
      updated_at: new Date().toISOString(),
    };
    const [row] = await db('event_settings?id=eq.1', { method: 'PATCH', body });
    return { ok: true, settings: row };
  },
};

function requireId(id) {
  if (!isUuid(id)) throw new HttpError(400, 'Invalid request id');
}

export default handler(async (req, res) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const body = await readJson(req);
  if (!pinMatches(body.pin)) throw new HttpError(401, 'Wrong PIN');
  const action = ACTIONS[body.action];
  if (!action) throw new HttpError(400, 'Unknown action');
  send(res, 200, await action(body));
});
