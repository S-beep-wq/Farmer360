-- Slice 18: crop reference data for planning. See DATABASE.md sections 6 and 6a,
-- USER_WORKFLOWS.md section 5 ("The system must clearly distinguish estimates from verified facts").
--
-- Reference ranges for a crop in a season and area (duration, water, labour, cost, yield, price),
-- from an agronomic or official source. Like schemes and insurance, this is external data: farmers
-- only read it, and the Kisan 360 team loads it with public.import_crop_reference() (service role
-- only; see docs/CROP_REFERENCES.md). Every row names its source and the date it was checked.

create table public.crop_references (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  crop_id uuid not null references public.crop_catalog (id),
  -- The season this reference is for: the crop is usually grown then.
  season text not null check (season in ('kharif', 'rabi', 'zaid')),
  -- Null: all of India. Otherwise the state, and optionally some districts (empty: whole state).
  state text check (state is null or char_length(btrim(state)) between 1 and 100),
  districts text[] not null default '{}',
  duration_days_min integer check (duration_days_min > 0),
  duration_days_max integer check (duration_days_max > 0),
  water_need text check (water_need in ('LOW', 'MEDIUM', 'HIGH')),
  -- Person-days of work per acre over the season.
  labour_days_per_acre_min numeric(8, 1) check (labour_days_per_acre_min > 0),
  labour_days_per_acre_max numeric(8, 1) check (labour_days_per_acre_max > 0),
  -- Cost of cultivation per acre (inputs, hired labour, machinery), in rupees.
  cost_per_acre_min numeric(12, 2) check (cost_per_acre_min > 0),
  cost_per_acre_max numeric(12, 2) check (cost_per_acre_max > 0),
  yield_kg_per_acre_min numeric(12, 1) check (yield_kg_per_acre_min > 0),
  yield_kg_per_acre_max numeric(12, 1) check (yield_kg_per_acre_max > 0),
  -- Farm-gate or market price per quintal (100 kg), in rupees.
  price_per_quintal_min numeric(12, 2) check (price_per_quintal_min > 0),
  price_per_quintal_max numeric(12, 2) check (price_per_quintal_max > 0),
  source_name text not null check (char_length(btrim(source_name)) between 1 and 200),
  source_url text not null check (source_url ~ '^https://'),
  last_verified_at date not null,
  status text not null default 'PUBLISHED' check (status in ('PUBLISHED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crop_references_districts_need_state check (state is not null or districts = '{}'),
  constraint crop_references_duration_range check (
    (duration_days_min is null) = (duration_days_max is null)
    and (duration_days_min is null or duration_days_min <= duration_days_max)
  ),
  constraint crop_references_labour_range check (
    (labour_days_per_acre_min is null) = (labour_days_per_acre_max is null)
    and (labour_days_per_acre_min is null or labour_days_per_acre_min <= labour_days_per_acre_max)
  ),
  constraint crop_references_cost_range check (
    (cost_per_acre_min is null) = (cost_per_acre_max is null)
    and (cost_per_acre_min is null or cost_per_acre_min <= cost_per_acre_max)
  ),
  constraint crop_references_yield_range check (
    (yield_kg_per_acre_min is null) = (yield_kg_per_acre_max is null)
    and (yield_kg_per_acre_min is null or yield_kg_per_acre_min <= yield_kg_per_acre_max)
  ),
  constraint crop_references_price_range check (
    (price_per_quintal_min is null) = (price_per_quintal_max is null)
    and (price_per_quintal_min is null or price_per_quintal_min <= price_per_quintal_max)
  )
);

create trigger crop_references_set_updated_at
  before update on public.crop_references
  for each row execute function public.set_updated_at();

-- Text per language: what inputs the crop needs, its main production risks, market notes.
create table public.crop_reference_texts (
  reference_id uuid not null references public.crop_references (id) on delete cascade,
  locale text not null check (locale in ('hi', 'en')),
  input_needs text check (input_needs is null or char_length(btrim(input_needs)) between 1 and 1000),
  production_risks text check (production_risks is null or char_length(btrim(production_risks)) between 1 and 1000),
  market_notes text check (market_notes is null or char_length(btrim(market_notes)) between 1 and 1000),
  primary key (reference_id, locale)
);

-- Creates or updates one reference (matched by slug) with its texts, all at once.
create or replace function public.import_crop_reference(p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_crop uuid;
  loc text;
  t jsonb;
begin
  if coalesce(p->>'slug', '') = '' then
    raise exception 'slug is required' using errcode = 'check_violation';
  end if;
  if coalesce(p->>'source_url', '') = '' or coalesce(p->>'source_name', '') = '' then
    raise exception '%: source_name and source_url are required', p->>'slug' using errcode = 'check_violation';
  end if;
  if coalesce(p->>'last_verified_at', '') = '' then
    raise exception '%: last_verified_at is required', p->>'slug' using errcode = 'check_violation';
  end if;
  if (p->>'last_verified_at')::date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception '%: last_verified_at cannot be in the future', p->>'slug' using errcode = 'check_violation';
  end if;
  select c.id into v_crop from public.crop_catalog c where lower(c.name) = lower(p->>'crop');
  if v_crop is null then
    raise exception '%: unknown crop "%" (use the English name from the crop catalog)', p->>'slug', p->>'crop'
      using errcode = 'check_violation';
  end if;
  foreach loc in array array['hi', 'en'] loop
    if jsonb_typeof(p->'texts'->loc) is distinct from 'object' then
      raise exception '%: texts.% is required', p->>'slug', loc using errcode = 'check_violation';
    end if;
  end loop;

  insert into public.crop_references as r (
    slug, crop_id, season, state, districts,
    duration_days_min, duration_days_max, water_need,
    labour_days_per_acre_min, labour_days_per_acre_max,
    cost_per_acre_min, cost_per_acre_max,
    yield_kg_per_acre_min, yield_kg_per_acre_max,
    price_per_quintal_min, price_per_quintal_max,
    source_name, source_url, last_verified_at, status
  ) values (
    p->>'slug', v_crop, p->>'season', nullif(p->>'state', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p->'districts', '[]'))), '{}'),
    (p->>'duration_days_min')::integer, (p->>'duration_days_max')::integer, nullif(p->>'water_need', ''),
    (p->>'labour_days_per_acre_min')::numeric, (p->>'labour_days_per_acre_max')::numeric,
    (p->>'cost_per_acre_min')::numeric, (p->>'cost_per_acre_max')::numeric,
    (p->>'yield_kg_per_acre_min')::numeric, (p->>'yield_kg_per_acre_max')::numeric,
    (p->>'price_per_quintal_min')::numeric, (p->>'price_per_quintal_max')::numeric,
    p->>'source_name', p->>'source_url', (p->>'last_verified_at')::date,
    coalesce(nullif(p->>'status', ''), 'PUBLISHED')
  )
  on conflict (slug) do update set
    crop_id = excluded.crop_id,
    season = excluded.season,
    state = excluded.state,
    districts = excluded.districts,
    duration_days_min = excluded.duration_days_min,
    duration_days_max = excluded.duration_days_max,
    water_need = excluded.water_need,
    labour_days_per_acre_min = excluded.labour_days_per_acre_min,
    labour_days_per_acre_max = excluded.labour_days_per_acre_max,
    cost_per_acre_min = excluded.cost_per_acre_min,
    cost_per_acre_max = excluded.cost_per_acre_max,
    yield_kg_per_acre_min = excluded.yield_kg_per_acre_min,
    yield_kg_per_acre_max = excluded.yield_kg_per_acre_max,
    price_per_quintal_min = excluded.price_per_quintal_min,
    price_per_quintal_max = excluded.price_per_quintal_max,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    last_verified_at = excluded.last_verified_at,
    status = excluded.status
  returning r.id into v_id;

  delete from public.crop_reference_texts x where x.reference_id = v_id;
  foreach loc in array array['hi', 'en'] loop
    t := p->'texts'->loc;
    insert into public.crop_reference_texts (reference_id, locale, input_needs, production_risks, market_notes)
    values (v_id, loc, nullif(t->>'input_needs', ''), nullif(t->>'production_risks', ''), nullif(t->>'market_notes', ''));
  end loop;

  return v_id;
end;
$$;

revoke all on function public.import_crop_reference(jsonb) from public, anon, authenticated;
grant execute on function public.import_crop_reference(jsonb) to service_role;

alter table public.crop_references enable row level security;
alter table public.crop_reference_texts enable row level security;

revoke all on public.crop_references, public.crop_reference_texts from anon, authenticated;
grant select on public.crop_references, public.crop_reference_texts to authenticated;

create policy "crop_references: published, for signed-in users" on public.crop_references
  for select to authenticated using (status = 'PUBLISHED');
create policy "crop_reference_texts: of published references" on public.crop_reference_texts
  for select to authenticated
  using (exists (select 1 from public.crop_references r where r.id = reference_id and r.status = 'PUBLISHED'));
