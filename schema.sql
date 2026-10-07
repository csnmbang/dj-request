-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- Matches the live database as of 7 Oct 2026 (taken from a full backup before
-- pausing the Supabase project).
--
-- WARNING: the access rules below are wide open. With the public anon key
-- (which is in index.html), anyone can update or delete requests and change
-- event_settings. The DJ PIN is only checked in the browser, so it does not
-- protect the data. Before reusing this, move DJ actions to a server function
-- that checks the PIN and limit update/delete to the service role.

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
  message text
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

create policy "Anyone can submit a request"
  on requests for insert
  with check (true);

create policy "Anyone can read requests"
  on requests for select
  using (true);

-- Open to anyone (see warning at top)
create policy public_update
  on requests for update
  using (true) with check (true);

create policy public_delete
  on requests for delete
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

-- Open to anyone (see warning at top)
create policy event_update
  on event_settings for update
  using (true) with check (true);
