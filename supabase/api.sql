-- Xplore: the extraction API's tables. Paste into the Supabase SQL Editor and run once, after
-- schema.sql. Safe to re-run.
--
-- The API server reads and writes these with the secret key, which bypasses row level security.
-- RLS is on with no policies, so the app's publishable key can't read or change them: nobody can
-- poison the shared results or read other people's feedback. Saved places are the exception:
-- each person reads and writes their own row directly from the app.

-- ── Extraction results, shared by everyone who pastes the same video ─────────────────────────

create table if not exists public.api_extractions (
  video_id text primary key,
  result jsonb not null,
  model text,
  created_at timestamptz not null default now(),
  -- YouTube's developer policies limit how long API data is kept without a refresh.
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists api_extractions_expires on public.api_extractions (expires_at);

-- ── Place matches: what a name plus area resolved to ─────────────────────────────────────────
-- Google allows keeping place IDs indefinitely, and latitude and longitude for up to 30 days
-- (Maps Platform Service Specific Terms, 14.3). Nothing else from Places is stored.

create table if not exists public.api_matches (
  query text primary key,
  -- Null when Google had no match.
  place_id text,
  lat double precision,
  lng double precision,
  location_fetched_at timestamptz,
  -- Our own judgement, not Google content: the address didn't mention the video's area.
  needs_check boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.api_matches add column if not exists needs_check boolean not null default false;
create index if not exists api_matches_location_age on public.api_matches (location_fetched_at);

-- ── Right / Wrong answers from the review screen ────────────────────────────────────────────

create table if not exists public.api_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  video_id text,
  place_name text not null check (char_length(place_name) between 1 and 200),
  place_id text,
  verdict text not null check (verdict in ('right', 'wrong', 'added')),
  created_at timestamptz not null default now()
);

-- ── Usage counters: rate limits per person and per network, and the free-tier caps ─────────

create table if not exists public.api_usage (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

alter table public.api_extractions enable row level security;
alter table public.api_matches enable row level security;
alter table public.api_feedback enable row level security;
alter table public.api_usage enable row level security;

-- Counts one use against each bucket and returns the first bucket that went over its limit (null
-- when all are within). Each bucket has its own window length in seconds. Internal: the two
-- functions below are what the server calls.
drop function if exists public.api_consume(text[], integer[], integer[]);

create or replace function public.api_count(p_buckets text[], p_seconds integer[], p_limits integer[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
  w timestamptz;
  c integer;
  over text := null;
begin
  for i in 1 .. coalesce(array_length(p_buckets, 1), 0) loop
    w := to_timestamp(floor(extract(epoch from now()) / p_seconds[i]) * p_seconds[i]);
    insert into api_usage (bucket, window_start, count) values (p_buckets[i], w, 1)
    on conflict (bucket, window_start) do update set count = api_usage.count + 1
    returning count into c;
    if c > p_limits[i] and over is null then
      over := p_buckets[i];
    end if;
  end loop;
  return over;
end;
$$;

-- For a new link (and feedback): the rate limits, plus, when asked, the housekeeping the storage
-- rules require, so expired data never lingers. Once per link, not once per place: ten place
-- matches running at once would otherwise queue behind each other's cleanup.
create or replace function public.api_consume(
  p_buckets text[], p_seconds integer[], p_limits integer[], p_cleanup boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  over text;
begin
  over := api_count(p_buckets, p_seconds, p_limits);
  if p_cleanup then
    delete from api_extractions where expires_at < now();
    update api_matches set lat = null, lng = null, location_fetched_at = null
      where location_fetched_at < now() - interval '30 days';
    delete from api_usage where window_start < now() - interval '3 days';
  end if;
  return over;
end;
$$;

-- Everything a place match needs to know before it calls Google, in one round trip: the caller's
-- rate limits, what we already have stored for this name, and whether today's free caps allow a
-- Place Details lookup (only counted when nothing fresh is stored) and a photo.
create or replace function public.api_match_begin(
  p_query text,
  p_user_bucket text, p_user_limit integer,
  p_ip_bucket text, p_ip_limit integer,
  p_details_limit integer,
  p_want_photo boolean, p_photo_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m api_matches%rowtype;
  has_row boolean;
  fresh boolean;
  over text;
  details_ok boolean := true;
  photo_ok boolean := false;
begin
  over := api_count(array[p_user_bucket, p_ip_bucket], array[3600, 3600], array[p_user_limit, p_ip_limit]);
  if over is not null then
    return jsonb_build_object('over', over);
  end if;

  select * into m from api_matches where query = p_query;
  has_row := found;
  -- A miss is asked again after a week; a place's coordinates are good for 30 days.
  fresh := has_row and (
    (m.place_id is null and m.updated_at > now() - interval '7 days')
    or (m.place_id is not null and m.location_fetched_at > now() - interval '30 days')
  );

  if not fresh then
    details_ok := api_count(array['global:place-details'], array[86400], array[p_details_limit]) is null;
  end if;
  -- Counted before we know the place has a photo; at worst the cap is reached a little early.
  if p_want_photo and not (fresh and m.place_id is null) then
    photo_ok := api_count(array['global:photos'], array[86400], array[p_photo_limit]) is null;
  end if;

  return jsonb_build_object(
    'over', null,
    'stored', case when has_row then jsonb_build_object(
      'place_id', m.place_id,
      'fresh', fresh,
      'lat', case when fresh then m.lat end,
      'lng', case when fresh then m.lng end,
      'needs_check', m.needs_check
    ) end,
    'details_ok', details_ok,
    'photo_ok', photo_ok
  );
end;
$$;

revoke all on function public.api_count(text[], integer[], integer[]) from public, anon, authenticated;
revoke all on function public.api_consume(text[], integer[], integer[], boolean) from public, anon, authenticated;
revoke all on function public.api_match_begin(text, text, integer, text, integer, integer, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.api_consume(text[], integer[], integer[], boolean) to service_role;
grant execute on function public.api_match_begin(text, text, integer, text, integer, integer, boolean, integer)
  to service_role;

-- ── Saved places, one row per person, read and written by the app itself ────────────────────

create table if not exists public.saved_collections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.saved_collections enable row level security;

drop policy if exists "own collections" on public.saved_collections;
create policy "own collections" on public.saved_collections
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
