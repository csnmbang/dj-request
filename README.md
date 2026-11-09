# BANGHER REQUEST

**Live: [dj-request-seven.vercel.app](https://dj-request-seven.vercel.app)**

Live song requests for DJ sets. Fans scan a QR code, follow the DJ on
Instagram, search YouTube for a song (or type it), and land in a queue that
updates in real time in the DJ Booth. Each fan gets their place in line and
an estimated wait. The DJ gets a phone push for every request, even with
the screen locked.

## How it works

```
 Fan's phone                    Vercel functions (/api)              Supabase
 ───────────                    ───────────────────────              ────────
 search box ── GET /api/search ──► YouTube Data API (key on server)
 send       ── POST /api/request ─► validate ─ insert (service role) ─► requests
                                    └─ ntfy push ──► DJ's phone
 DJ Booth   ── POST /api/dj ──────► check PIN ─ update (service role) ─► requests,
               (play/played/clear/settings)                              event_settings
 queue view ◄─────────── realtime subscription (anon key, read-only) ───┘
```

- **Frontend:** one HTML file of vanilla JS and CSS, no build step, so
  there's very little to download on club Wi-Fi.
- **Realtime:** Supabase Postgres changes stream to every open queue view.
- **Server:** three small Vercel functions with no dependencies, using the built-in
  `fetch` against Supabase's REST API.

## Security model

The browser gets only the Supabase URL and anon key. Those are public by
design, and the database policies limit that key to **reading** the queue.
Everything that changes data goes through `/api`:

| Concern | How it's handled |
|---|---|
| YouTube API key | Kept in a server environment variable. The browser calls `/api/search` and never sees the key |
| DJ PIN | Checked on the server for **every** DJ action, with a constant-time compare. There's no PIN in the page |
| Writes | Database policies allow anon `select` only. Writes use the service role key on the server |
| Junk or oversized input | Length limits in the API **and** check constraints in Postgres |
| Script injection | Fan-entered text is HTML-escaped before rendering. Video ids must match YouTube's 11-character format. Request ids must be UUIDs, so they can't be used to inject extra filters into the REST query |
| Push topic | ntfy topic name is a server environment variable, so it can't be scraped from the page and spammed |

The first version did all of this in the browser, and anyone who opened
the page source could act as the DJ. `migrations/002_lock_down.sql` is the
fix, with notes on what changed.

Known limits: there is no rate limiting or PIN lockout yet. Use a long
`DJ_PIN`. The Instagram "follow" step only opens the profile and is
on the honor system; Instagram offers no API to verify a follow.

## Setup

1. **Database:** in the Supabase SQL Editor, run `migrations/001_schema.sql` for a
   new project, or `migrations/002_lock_down.sql` to upgrade an existing one.
2. **Frontend config:** set `SUPABASE_URL` and `SUPABASE_ANON` at the top of the
   `<script>` in `index.html`.
3. **Server config:** in Vercel → Settings → Environment Variables, add everything in
   [`.env.example`](.env.example).
4. **Deploy:** import the repo in Vercel. `index.html` is served as is and `/api/*`
   becomes serverless functions.

## Tests

```bash
npm test
```

Uses Node's built-in test runner with no dependencies. Supabase, YouTube and
ntfy are faked, so the tests run offline. They cover PIN rejection, filter
injection, input limits, the paused state, and that keys never reach the
response.

## Files

| Path | What |
|---|---|
| `index.html` | The whole fan and DJ UI |
| `api/search.js` | YouTube search proxy |
| `api/request.js` | Fan submits a request |
| `api/dj.js` | DJ Booth actions, PIN-checked |
| `api/_lib.js` | Shared helpers: validation, PIN check, Supabase REST client |
| `migrations/` | Database schema and the lock-down migration |
| `test/` | API tests |

## License

MIT
