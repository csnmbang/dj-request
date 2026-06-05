# BANGHER REQUEST 🎧

A live DJ song request platform with Instagram follow-gate, YouTube search, and real-time queue.

## Features

- **Follow-gate** — fans must follow @djbangher on Instagram to unlock the request form
- **YouTube search** — live search via YouTube Data API v3 with thumbnail previews
- **Beatport search** — BPM + key data (demo mode, swap in Beatport API key to go live)
- **Free text fallback** — fans can describe any song if they can't find it
- **Real-time queue** — powered by Supabase, updates instantly in the DJ Booth
- **DJ Dashboard** — live queue view, preview any YouTube request, mark songs playing/played

## Stack

| Layer | Tool |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (single file) |
| Database | Supabase (PostgreSQL + Realtime) |
| Song search | YouTube Data API v3 |
| Hosting | Vercel (deploy from this repo) |

## Setup

### 1. Supabase

Run `schema.sql` in your Supabase project's SQL Editor (Dashboard → SQL Editor → New Query).

### 2. YouTube API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **YouTube Data API v3**
3. Create an API key → restrict to YouTube Data API v3
4. Open the app → DJ Booth tab → paste key → Save

### 3. Environment Config

In `index.html`, update the config block at the top of the `<script>`:

```js
var SUPABASE_URL  = 'your-project-url';
var SUPABASE_ANON = 'your-anon-key';
```

### 4. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Git Repository
3. Select this repo → Deploy
4. Your URL will be `bangher-request.vercel.app` (or custom domain)

## Instagram DM Automation (ManyChat)

To auto-send queue confirmation DMs:

1. Create a [ManyChat](https://manychat.com) account → connect Instagram
2. Set keyword trigger: **REQUEST**
3. Auto-reply with fan's queue position link
4. Connect ManyChat to your Supabase via webhook for live queue data

## License

MIT — fork it, build on it, keep it human. 🎛
