// POST /api/request -> a fan submits a song. Validated here, inserted with the
// service role, then the DJ's phone is pinged via ntfy.
import { handler, send, readJson, cleanText, isVideoId, db, HttpError, LIMITS } from './_lib.js';

export default handler(async (req, res) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const b = await readJson(req);

  const [settings] = await db('event_settings?id=eq.1&select=is_accepting');
  if (settings && settings.is_accepting === false) throw new HttpError(409, 'Requests are paused right now');

  const source = b.source === 'yt' ? 'yt' : 'txt';
  const videoId = source === 'yt' ? b.videoId : null;
  if (source === 'yt' && !isVideoId(videoId)) throw new HttpError(400, 'Invalid video');

  const row = {
    ig_handle: (cleanText(b.ig, LIMITS.ig, { field: 'Instagram handle' }) ?? 'anonymous').replace(/^@/, ''),
    song_title: cleanText(b.title, LIMITS.title, { required: true, field: 'Song' }),
    song_channel: cleanText(b.channel, LIMITS.channel, { field: 'Channel' }),
    song_source: source,
    video_id: videoId,
    // Thumbnails are derived from the video id, never taken from the client.
    thumb_url: videoId ? `https://i.ytimg.com/vi/${videoId}/default.jpg` : null,
    message: cleanText(b.message, LIMITS.message, { field: 'Message' }),
    status: 'pending',
  };

  const [inserted] = await db('requests', { method: 'POST', body: row });
  const pending = await db('requests?status=eq.pending&select=id');

  const topic = process.env.NTFY_TOPIC;
  if (topic) {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      body: `${row.song_title} from @${row.ig_handle}`,
      headers: { Title: 'New Request', Priority: 'high', Tags: 'musical_note' },
    }).catch((e) => console.error('ntfy failed', e));
  }

  send(res, 201, { id: inserted.id, position: pending?.length || inserted.queue_position });
});
