-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

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
  status text not null default 'pending',  -- 'pending' | 'playing' | 'played' | 'skipped'

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

-- Row Level Security: anyone can insert, only authenticated (you) can update/delete
alter table requests enable row level security;

create policy "Anyone can submit a request"
  on requests for insert
  with check (true);

create policy "Anyone can read requests"
  on requests for select
  using (true);

create policy "Only service role can update"
  on requests for update
  using (auth.role() = 'service_role');

create policy "Only service role can delete"
  on requests for delete
  using (auth.role() = 'service_role');
