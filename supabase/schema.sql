-- Xplore: shared trips. Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- People sign in anonymously (no password, no email): the app calls signInAnonymously() on first
-- use, so every phone and browser gets its own user id. A trip is visible only to its members, and
-- the only way to become a member is create_trip (you made it) or join_trip (you have its code).

create extension if not exists pgcrypto;

-- ── Tables ────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  -- Six letters, no 0/O or 1/I, so it can be read out loud or typed from a screenshot.
  code text not null unique,
  city_id text not null,
  owner uuid not null references auth.users (id) on delete cascade,
  -- solo | partner | friends | family
  party text not null,
  -- The whole TripPlan as the app builds it (days, stops, times). Places are referenced by id from
  -- the app's own catalog; custom stops carry their own title and note.
  plan jsonb not null,
  -- placeId → the place a swap would bring in, fixed when the trip is shared.
  swap_for jsonb not null default '{}'::jsonb,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  tint text not null,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.votes (
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('keep', 'swap', 'drop')),
  emoji text not null,
  note text check (note is null or char_length(note) <= 140),
  updated_at timestamptz not null default now(),
  -- One vote per person per stop: voting again replaces it, so two people can never clash.
  primary key (trip_id, place_id, user_id)
);

-- ── Membership ────────────────────────────────────────────────────────────────────────────────

-- Security definer so the policies below can ask "is this person on the trip" without recursing
-- into the members table's own policy.
create or replace function public.is_member(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where trip_id = t and user_id = auth.uid());
$$;

create or replace function public.new_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.trips where code = c);
  end loop;
  return c;
end;
$$;

-- Makes the trip and puts its owner in it, in one step.
create or replace function public.create_trip(
  p_city_id text,
  p_party text,
  p_plan jsonb,
  p_swap_for jsonb,
  p_name text,
  p_tint text
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trips;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  insert into public.trips (code, city_id, owner, party, plan, swap_for)
  values (public.new_code(), p_city_id, auth.uid(), p_party, p_plan, coalesce(p_swap_for, '{}'::jsonb))
  returning * into t;
  insert into public.members (trip_id, user_id, name, tint) values (t.id, auth.uid(), p_name, p_tint);
  return t;
end;
$$;

-- Joins by code. Joining again just updates your name.
create or replace function public.join_trip(p_code text, p_name text, p_tint text)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trips;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  select * into t from public.trips where code = upper(trim(p_code));
  if not found then
    raise exception 'No trip with that code';
  end if;
  insert into public.members (trip_id, user_id, name, tint)
  values (t.id, auth.uid(), p_name, p_tint)
  on conflict (trip_id, user_id) do update set name = excluded.name;
  return t;
end;
$$;

-- ── Row level security ────────────────────────────────────────────────────────────────────────

alter table public.trips enable row level security;
alter table public.members enable row level security;
alter table public.votes enable row level security;

drop policy if exists "members read trips" on public.trips;
create policy "members read trips" on public.trips for select using (public.is_member(id));
-- Any member may edit the plan (adding their own stop); only the owner locks it (checked in the app
-- and by the lock column staying owner-only below).
drop policy if exists "members edit trips" on public.trips;
create policy "members edit trips" on public.trips for update using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists "members read members" on public.members;
create policy "members read members" on public.members for select using (public.is_member(trip_id));

drop policy if exists "members read votes" on public.votes;
create policy "members read votes" on public.votes for select using (public.is_member(trip_id));
drop policy if exists "members cast their own votes" on public.votes;
create policy "members cast their own votes" on public.votes for insert
  with check (user_id = auth.uid() and public.is_member(trip_id));
drop policy if exists "members change their own votes" on public.votes;
create policy "members change their own votes" on public.votes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(trip_id));

-- Only the owner can lock or unlock.
create or replace function public.guard_lock()
returns trigger
language plpgsql
as $$
begin
  if new.locked is distinct from old.locked and old.owner <> auth.uid() then
    raise exception 'Only the person who made the trip can lock it in';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists guard_lock on public.trips;
create trigger guard_lock before update on public.trips for each row execute function public.guard_lock();

grant select, update on public.trips to authenticated;
grant select on public.members to authenticated;
grant select, insert, update on public.votes to authenticated;
grant execute on function public.create_trip, public.join_trip to authenticated;

-- ── Realtime ──────────────────────────────────────────────────────────────────────────────────
-- Everyone on a trip sees joins, votes and plan edits the moment they happen.

do $$
begin
  begin alter publication supabase_realtime add table public.trips; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.votes; exception when duplicate_object then null; end;
end $$;
