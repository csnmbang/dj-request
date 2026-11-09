-- Locks down the database that schema.sql originally created with
-- wide-open policies. Run once in the Supabase SQL Editor, after the
-- /api functions are deployed with their environment variables.
--
-- Before: anyone holding the public anon key could insert, edit or
-- delete requests and change event settings. The DJ PIN only lived in
-- the browser, so it protected nothing.
-- After: anon can only read. Writes go through /api (service role).

drop policy if exists "Anyone can submit a request" on requests;
drop policy if exists public_update on requests;
drop policy if exists public_delete on requests;
drop policy if exists event_update on event_settings;

-- Bound what the table accepts. NOT VALID skips checking old rows, so
-- the migration can't fail on data written before the limits existed.
alter table requests
  add constraint ig_len      check (char_length(ig_handle)  <= 40)  not valid,
  add constraint title_len   check (char_length(song_title) between 1 and 200) not valid,
  add constraint channel_len check (char_length(song_channel) <= 120) not valid,
  add constraint message_len check (char_length(message)    <= 280) not valid,
  add constraint source_ok   check (song_source in ('yt', 'txt', 'bp')) not valid,
  add constraint video_ok    check (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$') not valid,
  add constraint status_ok   check (status in ('pending', 'playing', 'played', 'skipped', 'deleted')) not valid;
