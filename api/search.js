// GET /api/search?q=... -> YouTube search, proxied so the API key stays server-side.
import { handler, send, env, HttpError, LIMITS } from './_lib.js';

export default handler(async (req, res) => {
  if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
  const q = new URL(req.url, 'http://x').searchParams.get('q')?.trim() ?? '';
  if (q.length < 3 || q.length > LIMITS.query) throw new HttpError(400, 'Query must be 3-100 characters');

  const url = 'https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams({
    part: 'snippet', type: 'video', maxResults: '8', q, key: env('YOUTUBE_API_KEY'),
  });
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok || data.error) {
    console.error('YouTube error', data.error);
    throw new HttpError(502, 'Search is unavailable right now');
  }

  // Return only what the UI needs.
  const items = (data.items ?? [])
    .filter((i) => i.id?.videoId)
    .map((i) => ({
      videoId: i.id.videoId,
      title: i.snippet?.title ?? '',
      channel: i.snippet?.channelTitle ?? '',
      thumb: i.snippet?.thumbnails?.default?.url ?? '',
    }));
  res.setHeader('Cache-Control', 'public, max-age=300'); // same query within 5 min = no quota spent
  send(res, 200, { items });
});
