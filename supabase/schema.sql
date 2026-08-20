-- KrishiSetu — Supabase schema (replaces Firestore users/bookings/labours collections)
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query) on a fresh project.

create extension if not exists "pgcrypto";

-- ── profiles (was Firestore `users/{uid}`) ──────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  phone text,
  village text,
  role text not null check (role in ('farmer','supervisor','admin')),
  labour_count int default 0,                 -- supervisor: size of own team
  crop_type text[],                            -- farmer
  farm_size text,                               -- farmer
  supervisor_lat double precision,              -- supervisor live GPS
  supervisor_lng double precision,
  supervisor_location_updated_at timestamptz,
  created_at timestamptz default now()
);

-- ── bookings ─────────────────────────────────────────────────────────────
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid references public.profiles(id),
  farmer_name text,
  farmer_phone text,
  village text,
  farm_address text,
  landmark text,
  farm_lat double precision,
  farm_lng double precision,
  labour_count int,
  time_slot text,                               -- "8-12" | "2-6" | "fullday"
  work_type text,
  date date,
  description text,
  total_cost numeric,
  rate_per_labour numeric,
  status text default 'pending',                -- "pending" | "assigned" | "completed"
  supervisor_id uuid references public.profiles(id),
  supervisor_name text,
  supervisor_phone text,
  assigned_labour int default 0,
  assigned_labour_ids uuid[] default '{}',
  assigned_labour_names text[] default '{}',
  farmer_confirmed boolean default false,
  supervisor_confirmed boolean default false,
  farmer_attendance jsonb default '{}',
  labour_attendance jsonb default '{}',
  supervisor_visited_farm boolean,
  supervisor_visited_at timestamptz,
  supervisor_visit_distance int,
  payment_method text,                          -- "online" | "cash"
  payment_status text,                          -- "paid" | "cash_on_delivery"
  payment_id text,
  payment_order_id text,
  payment_signature text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- ── labours ──────────────────────────────────────────────────────────────
create table public.labours (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  supervisor_id uuid references public.profiles(id),
  supervisor_name text,
  available boolean default true,
  unavailability jsonb default '{}',            -- { "YYYY-MM-DD_slot": "reason" }
  attendance_marked boolean default false,
  created_at timestamptz default now()
);

-- ── row level security ───────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.labours  enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles
create policy "profiles_select_all"   on public.profiles for select to authenticated using (true);
create policy "profiles_insert_own"   on public.profiles for insert to authenticated with check (auth.uid() = id or public.is_admin());
create policy "profiles_update_own"   on public.profiles for update to authenticated using (auth.uid() = id or public.is_admin());
create policy "profiles_delete_admin" on public.profiles for delete to authenticated using (public.is_admin());

-- bookings
create policy "bookings_select_all"    on public.bookings for select to authenticated using (true);
create policy "bookings_insert_farmer" on public.bookings for insert to authenticated with check (auth.uid() = farmer_id);
create policy "bookings_update_party"  on public.bookings for update to authenticated using (auth.uid() = farmer_id or auth.uid() = supervisor_id or supervisor_id is null or public.is_admin());
create policy "bookings_delete_admin"  on public.bookings for delete to authenticated using (public.is_admin());

-- labours
create policy "labours_select_all"        on public.labours for select to authenticated using (true);
create policy "labours_insert_supervisor" on public.labours for insert to authenticated with check (auth.uid() = supervisor_id or public.is_admin());
create policy "labours_update_supervisor" on public.labours for update to authenticated using (auth.uid() = supervisor_id or public.is_admin());
create policy "labours_delete_admin"      on public.labours for delete to authenticated using (public.is_admin());

-- ── realtime (dashboards subscribe to postgres_changes on these tables) ───
alter publication supabase_realtime add table public.profiles, public.bookings, public.labours;
