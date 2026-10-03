-- Slice 1: farmer profile, farms and plots (with plot location and boundary).
-- See DATABASE.md sections 3, 4, 5 and 26.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- farmers
-- ---------------------------------------------------------------------------

create table public.farmers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid()
    references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  -- Always copied from the verified auth phone number by a trigger; never trusted from the client.
  phone text,
  preferred_language text not null default 'hi' check (preferred_language in ('hi', 'en')),
  state text not null check (char_length(btrim(state)) between 1 and 100),
  district text not null check (char_length(btrim(district)) between 1 and 100),
  village text not null check (char_length(btrim(village)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pins user_id and phone to the authenticated user, whatever the client sends.
create or replace function public.farmers_enforce_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
  end if;

  select case when u.phone is null or u.phone = '' then null else '+' || u.phone end
    into new.phone
    from auth.users u
   where u.id = new.user_id;

  return new;
end;
$$;

create trigger farmers_enforce_identity
  before insert or update on public.farmers
  for each row execute function public.farmers_enforce_identity();

create trigger farmers_set_updated_at
  before update on public.farmers
  for each row execute function public.set_updated_at();

-- The calling user's farmer id, or null when they have no profile yet.
create or replace function public.current_farmer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.id from public.farmers f where f.user_id = auth.uid();
$$;

revoke all on function public.current_farmer_id() from public, anon;
grant execute on function public.current_farmer_id() to authenticated;

-- ---------------------------------------------------------------------------
-- farms
-- ---------------------------------------------------------------------------

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null default public.current_farmer_id()
    references public.farmers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  state text check (state is null or char_length(btrim(state)) between 1 and 100),
  district text check (district is null or char_length(btrim(district)) between 1 and 100),
  village text check (village is null or char_length(btrim(village)) between 1 and 100),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  total_area numeric(12, 4) check (total_area > 0),
  area_unit text check (area_unit in ('acre', 'decimal', 'hectare')),
  irrigation_available boolean,
  irrigation_type text check (irrigation_type in ('tubewell', 'canal', 'well', 'pond_or_river', 'other')),
  soil_type text check (soil_type in ('loam', 'clay', 'sandy', 'sandy_loam', 'clay_loam', 'other', 'unknown')),
  soil_source text check (soil_source in ('farmer_estimate', 'soil_health_card', 'lab_test')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint farms_lat_lng_together check ((latitude is null) = (longitude is null)),
  constraint farms_area_with_unit check ((total_area is null) = (area_unit is null))
);

create index farms_farmer_id_idx on public.farms (farmer_id);

create trigger farms_set_updated_at
  before update on public.farms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- plots
-- ---------------------------------------------------------------------------

create table public.plots (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  -- Area as stated by the farmer.
  area numeric(12, 4) check (area > 0),
  area_unit text check (area_unit in ('acre', 'decimal', 'hectare')),
  -- Representative point of the plot (WGS 84).
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  location_source text check (location_source in ('device_gps', 'map_pin', 'boundary_centroid')),
  location_accuracy_m numeric(8, 1) check (location_accuracy_m >= 0),
  -- Plot boundary drawn by the farmer (WGS 84).
  boundary extensions.geography(Polygon, 4326),
  -- Calculated by trigger from boundary; never trusted from the client.
  boundary_area_sq_m numeric(14, 2),
  soil_type text check (soil_type in ('loam', 'clay', 'sandy', 'sandy_loam', 'clay_loam', 'other', 'unknown')),
  soil_ph numeric(3, 1) check (soil_ph between 0 and 14),
  soil_source text check (soil_source in ('farmer_estimate', 'soil_health_card', 'lab_test')),
  irrigation_available boolean,
  irrigation_type text check (irrigation_type in ('tubewell', 'canal', 'well', 'pond_or_river', 'other')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plots_lat_lng_together check ((latitude is null) = (longitude is null)),
  constraint plots_location_source_with_point check ((latitude is null) = (location_source is null)),
  constraint plots_area_with_unit check ((area is null) = (area_unit is null)),
  constraint plots_area_or_boundary check (area is not null or boundary is not null)
);

create index plots_farm_id_idx on public.plots (farm_id);

-- Validates the boundary and derives area (and, if missing, a location) from it.
create or replace function public.plots_derive_geometry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.boundary is null then
    new.boundary_area_sq_m := null;
    return new;
  end if;

  if not extensions.st_isvalid(new.boundary::extensions.geometry) then
    raise exception 'Plot boundary is not a valid polygon'
      using errcode = 'check_violation';
  end if;

  if extensions.st_npoints(new.boundary::extensions.geometry) > 501 then
    raise exception 'Plot boundary has too many points'
      using errcode = 'check_violation';
  end if;

  new.boundary_area_sq_m := round(extensions.st_area(new.boundary)::numeric, 2);

  -- Sanity limit: 1,000 hectares. A larger "plot" is almost certainly a drawing mistake.
  if new.boundary_area_sq_m <= 0 or new.boundary_area_sq_m > 10000000 then
    raise exception 'Plot boundary area is out of range'
      using errcode = 'check_violation';
  end if;

  if new.latitude is null then
    select round(extensions.st_y(c)::numeric, 6), round(extensions.st_x(c)::numeric, 6)
      into new.latitude, new.longitude
      from (select extensions.st_centroid(new.boundary::extensions.geometry) as c) as centroid;
    new.location_source := 'boundary_centroid';
    new.location_accuracy_m := null;
  end if;

  return new;
end;
$$;

create trigger plots_derive_geometry
  before insert or update on public.plots
  for each row execute function public.plots_derive_geometry();

create trigger plots_set_updated_at
  before update on public.plots
  for each row execute function public.set_updated_at();

-- Computed field exposed through the API: `select=boundary_geojson`.
create or replace function public.boundary_geojson(p public.plots)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select extensions.st_asgeojson(p.boundary)::jsonb;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security (DATABASE.md section 26)
-- A farmer can only see and change their own profile, farms and plots.
-- No DELETE policies: agricultural history is preserved (DATABASE.md section 24).
-- ---------------------------------------------------------------------------

alter table public.farmers enable row level security;
alter table public.farms enable row level security;
alter table public.plots enable row level security;

revoke all on public.farmers, public.farms, public.plots from anon;
revoke delete, truncate on public.farmers, public.farms, public.plots from authenticated;

create policy "farmers: select own profile" on public.farmers
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "farmers: insert own profile" on public.farmers
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "farmers: update own profile" on public.farmers
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "farms: select own farms" on public.farms
  for select to authenticated
  using (farmer_id = (select public.current_farmer_id()));

create policy "farms: insert own farms" on public.farms
  for insert to authenticated
  with check (farmer_id = (select public.current_farmer_id()));

create policy "farms: update own farms" on public.farms
  for update to authenticated
  using (farmer_id = (select public.current_farmer_id()))
  with check (farmer_id = (select public.current_farmer_id()));

create policy "plots: select plots on own farms" on public.plots
  for select to authenticated
  using (exists (
    select 1 from public.farms f
     where f.id = farm_id and f.farmer_id = (select public.current_farmer_id())
  ));

create policy "plots: insert plots on own farms" on public.plots
  for insert to authenticated
  with check (exists (
    select 1 from public.farms f
     where f.id = farm_id and f.farmer_id = (select public.current_farmer_id())
  ));

create policy "plots: update plots on own farms" on public.plots
  for update to authenticated
  using (exists (
    select 1 from public.farms f
     where f.id = farm_id and f.farmer_id = (select public.current_farmer_id())
  ))
  with check (exists (
    select 1 from public.farms f
     where f.id = farm_id and f.farmer_id = (select public.current_farmer_id())
  ));
