-- Slice 8: crop observations with photos. See DATABASE.md sections 10, 11 and SYSTEM_ARCHITECTURE.md
-- section 9 (storage).

-- ---------------------------------------------------------------------------
-- crop_observations: what the farmer saw on a crop, on a given day
-- ---------------------------------------------------------------------------

create table public.crop_observations (
  id uuid primary key default gen_random_uuid(),
  crop_cycle_id uuid not null references public.crop_cycles (id) on delete cascade,
  observation_date date not null,
  growth_stage text check (growth_stage is null or char_length(growth_stage) <= 100),
  -- The farmer's own judgement.
  health_status text not null check (health_status in ('HEALTHY', 'PROBLEM', 'SERIOUS', 'NOT_SURE')),
  farmer_notes text check (farmer_notes is null or char_length(farmer_notes) <= 1000),
  -- Reserved for a later, separate AI analysis. Farmers cannot write these columns (see grants
  -- below), so AI output can never overwrite or pose as the farmer's own observation.
  ai_analysis jsonb,
  ai_confidence numeric(3, 2) check (ai_confidence between 0 and 1),
  created_by text not null default 'FARMER' check (created_by in ('FARMER', 'SYSTEM')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crop_observations_crop_cycle_id_idx on public.crop_observations (crop_cycle_id);

create trigger crop_observations_set_updated_at
  before update on public.crop_observations
  for each row execute function public.set_updated_at();

-- Stays on its crop; nothing changes once the crop is COMPLETED (shared rule).
create trigger crop_observations_crop_cycle_check
  before insert or update on public.crop_observations
  for each row execute function public.crop_cycle_records_check();

-- New observations: only for a crop in the field, dated on or after its sowing.
create or replace function public.crop_observations_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cycle public.crop_cycles%rowtype;
begin
  select * into cycle from public.crop_cycles c where c.id = new.crop_cycle_id;
  if tg_op = 'INSERT' and cycle.status <> 'ACTIVE' then
    raise exception 'Observations can only be added to a crop in the field, not %', cycle.status
      using errcode = 'check_violation';
  end if;
  if new.observation_date < cycle.actual_sowing_date then
    raise exception 'An observation cannot be before the sowing date'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger crop_observations_check
  before insert or update on public.crop_observations
  for each row execute function public.crop_observations_check();

-- ---------------------------------------------------------------------------
-- Photo storage: private bucket "crop-photos", one folder per observation:
--   {farmer_id}/{farm_id}/{plot_id}/{crop_cycle_id}/{observation_id}/{file}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crop-photos', 'crop-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when every folder in a crop photo's path belongs to the signed-in farmer, in order:
-- the farmer, their farm, a plot on it, a crop on that plot and an observation of that crop.
create or replace function public.crop_photo_path_owned(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := string_to_array(p_name, '/');
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_name is null or array_length(parts, 1) <> 6 or parts[6] = '' then
    return false;
  end if;
  for i in 1..5 loop
    if parts[i] !~ uuid_re then
      return false;
    end if;
  end loop;

  return exists (
    select 1
      from public.crop_observations o
      join public.crop_cycles c on c.id = o.crop_cycle_id
      join public.plots p on p.id = c.plot_id
      join public.farms f on f.id = p.farm_id
     where o.id = parts[5]::uuid
       and c.id = parts[4]::uuid
       and p.id = parts[3]::uuid
       and f.id = parts[2]::uuid
       and f.farmer_id = parts[1]::uuid
       and f.farmer_id = public.current_farmer_id()
  );
end;
$$;

revoke all on function public.crop_photo_path_owned(text) from public, anon;
grant execute on function public.crop_photo_path_owned(text) to authenticated;

-- Farmers can upload into and read their own folders only. No update or delete: photos are kept.
create policy "crop-photos: farmers upload to their own folders" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'crop-photos' and public.crop_photo_path_owned(name));

create policy "crop-photos: farmers read their own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'crop-photos' and public.crop_photo_path_owned(name));

-- ---------------------------------------------------------------------------
-- crop_photos: metadata for a photo in storage (the image itself is in the bucket)
-- ---------------------------------------------------------------------------

create table public.crop_photos (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.crop_observations (id) on delete cascade,
  -- Ownership of the path is checked by the insert policy below.
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size integer not null check (file_size > 0 and file_size <= 5242880),
  captured_at timestamptz,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- The photo must be stored in its own observation's folder.
  constraint crop_photos_path_matches_observation
    check (split_part(storage_path, '/', 5) = observation_id::text)
);

create index crop_photos_observation_id_idx on public.crop_photos (observation_id);

-- ---------------------------------------------------------------------------
-- Row Level Security and column grants
-- ---------------------------------------------------------------------------

create or replace function public.owns_observation(p_observation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crop_observations o
     where o.id = p_observation_id
       and public.owns_crop_cycle(o.crop_cycle_id)
  );
$$;

revoke all on function public.owns_observation(uuid) from public, anon;
grant execute on function public.owns_observation(uuid) to authenticated;

alter table public.crop_observations enable row level security;
alter table public.crop_photos enable row level security;

revoke all on public.crop_observations, public.crop_photos from anon, authenticated;

-- Farmers may set only their own fields; ai_analysis, ai_confidence and created_by stay server-only.
grant select on public.crop_observations to authenticated;
grant insert (crop_cycle_id, observation_date, growth_stage, health_status, farmer_notes)
  on public.crop_observations to authenticated;
-- The only change after saving is removing an observation made by mistake.
grant update (deleted_at) on public.crop_observations to authenticated;

grant select on public.crop_photos to authenticated;
grant insert (observation_id, storage_path, file_name, mime_type, file_size, captured_at)
  on public.crop_photos to authenticated;

create policy "crop_observations: select on own crops" on public.crop_observations
  for select to authenticated using (public.owns_crop_cycle(crop_cycle_id));
create policy "crop_observations: insert on own crops" on public.crop_observations
  for insert to authenticated with check (public.owns_crop_cycle(crop_cycle_id));
create policy "crop_observations: update on own crops" on public.crop_observations
  for update to authenticated
  using (public.owns_crop_cycle(crop_cycle_id))
  with check (public.owns_crop_cycle(crop_cycle_id));

create policy "crop_photos: select on own observations" on public.crop_photos
  for select to authenticated using (public.owns_observation(observation_id));
create policy "crop_photos: insert on own observations" on public.crop_photos
  for insert to authenticated
  with check (public.owns_observation(observation_id) and public.crop_photo_path_owned(storage_path));
