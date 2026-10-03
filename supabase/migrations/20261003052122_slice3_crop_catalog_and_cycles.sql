-- Slice 3: crop catalog and crop cycles. See DATABASE.md sections 6 and 8.

-- ---------------------------------------------------------------------------
-- crop_catalog: shared reference list of crops (not farmer data)
-- ---------------------------------------------------------------------------

create table public.crop_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 100),
  -- Hindi name, for the Hindi-first interface.
  name_hi text not null check (char_length(btrim(name_hi)) between 1 and 100),
  category text not null check (category in ('cereal', 'pulse', 'oilseed', 'vegetable', 'cash', 'other')),
  scientific_name text,
  -- Agronomic fields stay empty until filled from a verified source (DATABASE.md section 7).
  season text,
  typical_duration_days integer check (typical_duration_days > 0),
  water_requirement text,
  labour_requirement text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger crop_catalog_set_updated_at
  before update on public.crop_catalog
  for each row execute function public.set_updated_at();

-- Starter list: common crops in Bihar, names only. No agronomic data is claimed here.
insert into public.crop_catalog (name, name_hi, category) values
  ('Rice (paddy)', 'धान', 'cereal'),
  ('Wheat', 'गेहूँ', 'cereal'),
  ('Maize', 'मक्का', 'cereal'),
  ('Lentil (masoor)', 'मसूर', 'pulse'),
  ('Chickpea (gram)', 'चना', 'pulse'),
  ('Pigeon pea (arhar)', 'अरहर', 'pulse'),
  ('Green gram (moong)', 'मूँग', 'pulse'),
  ('Mustard', 'सरसों', 'oilseed'),
  ('Potato', 'आलू', 'vegetable'),
  ('Onion', 'प्याज़', 'vegetable'),
  ('Tomato', 'टमाटर', 'vegetable'),
  ('Cauliflower', 'फूलगोभी', 'vegetable'),
  ('Brinjal', 'बैंगन', 'vegetable'),
  ('Okra (bhindi)', 'भिंडी', 'vegetable'),
  ('Sugarcane', 'गन्ना', 'cash'),
  ('Jute', 'जूट', 'cash');

alter table public.crop_catalog enable row level security;

revoke all on public.crop_catalog from anon;
revoke insert, update, delete, truncate on public.crop_catalog from authenticated;

create policy "crop_catalog: readable by signed-in users" on public.crop_catalog
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- crop_cycles: one crop grown on one plot
-- ---------------------------------------------------------------------------

create table public.crop_cycles (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots (id) on delete cascade,
  crop_id uuid not null references public.crop_catalog (id),
  -- Variety as named by the farmer. A crop_varieties table is added once verified variety data exists.
  variety_name text check (variety_name is null or char_length(btrim(variety_name)) between 1 and 100),
  season text not null check (season in ('kharif', 'rabi', 'zaid')),
  status text not null default 'PLANNED'
    check (status in ('PLANNED', 'ACTIVE', 'HARVESTED', 'COMPLETED', 'CANCELLED')),
  planned_sowing_date date,
  actual_sowing_date date,
  expected_harvest_date date,
  actual_harvest_date date,
  current_growth_stage text check (current_growth_stage is null or char_length(current_growth_stage) <= 100),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crop_cycles_has_a_sowing_date
    check (planned_sowing_date is not null or actual_sowing_date is not null),
  -- A planned crop has not been sown; a growing or harvested crop has.
  constraint crop_cycles_sowing_matches_status check (
    (status = 'PLANNED' and actual_sowing_date is null)
    or (status in ('ACTIVE', 'HARVESTED', 'COMPLETED') and actual_sowing_date is not null)
    or status = 'CANCELLED'
  ),
  constraint crop_cycles_harvest_after_sowing check (
    expected_harvest_date is null
    or expected_harvest_date >= coalesce(actual_sowing_date, planned_sowing_date)
  ),
  constraint crop_cycles_actual_harvest_after_sowing check (
    actual_harvest_date is null
    or (actual_sowing_date is not null and actual_harvest_date >= actual_sowing_date)
  )
);

create index crop_cycles_plot_id_idx on public.crop_cycles (plot_id);
create index crop_cycles_status_idx on public.crop_cycles (status);

create trigger crop_cycles_set_updated_at
  before update on public.crop_cycles
  for each row execute function public.set_updated_at();

-- True when the plot is on one of the signed-in farmer's farms.
create or replace function public.owns_plot(p_plot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.plots p
      join public.farms f on f.id = p.farm_id
     where p.id = p_plot_id
       and f.farmer_id = public.current_farmer_id()
  );
$$;

revoke all on function public.owns_plot(uuid) from public, anon;
grant execute on function public.owns_plot(uuid) to authenticated;

alter table public.crop_cycles enable row level security;

revoke all on public.crop_cycles from anon;
-- History is preserved: crop cycles are cancelled, never deleted (DATABASE.md sections 8 and 24).
revoke delete, truncate on public.crop_cycles from authenticated;

create policy "crop_cycles: select on own plots" on public.crop_cycles
  for select to authenticated
  using (public.owns_plot(plot_id));

create policy "crop_cycles: insert on own plots" on public.crop_cycles
  for insert to authenticated
  with check (public.owns_plot(plot_id));

create policy "crop_cycles: update on own plots" on public.crop_cycles
  for update to authenticated
  using (public.owns_plot(plot_id))
  with check (public.owns_plot(plot_id));
