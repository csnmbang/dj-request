-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- for a fresh project. Upgrading the existing database? Run
-- migrations/002_lock_down.sql instead.
--
-- Access model: the browser holds only the anon key, which can READ the
-- queue and event settings (for the live view) and nothing else. Every write
-- goes through the Vercel functions in /api, which check the DJ PIN and use
-- the service role key. The service role bypasses row level security.

-- ─── Requests ────────────────────────────────────────────────

create table requests (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),

  -- Fan info
  ig_handle text not null,

  -- Song info
  song_title text not null,
  song_channel text,
  song_source text not null default 'yt', -- 'yt' | 'bp' | 'txt'
  video_id text,                           -- YouTube video ID
  thumb_url text,                          -- YouTube thumbnail

  -- Queue
  queue_position integer,
  status text not null default 'pending',  -- 'pending' | 'playing' | 'played' | 'skipped' | 'deleted'

  -- Optional
  message text,

  -- Same limits the API enforces, so the database refuses junk too
  constraint ig_len      check (char_length(ig_handle)  <= 40),
  constraint title_len   check (char_length(song_title) between 1 and 200),
  constraint channel_len check (char_length(song_channel) <= 120),
  constraint message_len check (char_length(message)    <= 280),
  constraint source_ok   check (song_source in ('yt', 'txt')),
  constraint video_ok    check (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$'),
  constraint status_ok   check (status in ('pending', 'playing', 'played', 'skipped', 'deleted'))
);

-- Auto-assign queue position on insert
create or replace function assign_queue_position()
returns trigger as $$
begin
  NEW.queue_position := (
    select coalesce(max(queue_position), 0) + 1
    from requests
    where status = 'pending'
  );
  return NEW;
end;
$$ language plpgsql;

create trigger set_queue_position
before insert on requests
for each row execute function assign_queue_position();

-- Enable realtime (so DJ Booth updates live)
alter publication supabase_realtime add table requests;

alter table requests enable row level security;

-- Read-only for the public. No insert/update/delete policies on purpose:
-- writes go through /api with the service role.
create policy "Anyone can read requests"
  on requests for select
  using (true);

-- ─── Event settings (single row, id = 1) ─────────────────────

create table event_settings (
  id integer not null default 1 primary key,
  event_name text not null default 'WORLD CUP PARTY',
  venue_name text not null default '305 SPORTS BAR',
  event_date text not null default 'JUN 19',
  is_accepting boolean not null default true,
  avg_song_minutes integer not null default 3,
  updated_at timestamp with time zone default now()
);

-- The app only updates the row with id = 1, so it must exist
insert into event_settings (id) values (1);

alter table event_settings enable row level security;

create policy event_select
  on event_settings for select
  using (true);

-- No update policy: settings are changed only through /api/dj.
