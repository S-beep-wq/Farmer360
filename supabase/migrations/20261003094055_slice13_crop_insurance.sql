-- Slice 13: crop insurance information. See DATABASE.md section 18, PRODUCT_SPEC.md section 13
-- and USER_WORKFLOWS.md section 11.
--
-- Like government schemes (slice 12), this is official external data: farmers only read it, and
-- the Kisan 360 team loads it with public.import_insurance_product() (service role only; see
-- docs/INSURANCE.md) after checking it against the official source.

create table public.insurance_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  -- Who runs or regulates it, as on the official source (e.g. the government programme or insurer).
  provider text not null check (char_length(btrim(provider)) between 1 and 200),
  state text check (state is null or char_length(btrim(state)) between 1 and 100),
  districts text[] not null default '{}',
  seasons text[] not null default '{}' check (seasons <@ array['kharif', 'rabi', 'zaid']),
  -- Last day to enrol for the season, if announced.
  enrollment_deadline date,
  official_url text check (official_url is null or official_url ~ '^https://'),
  source_name text not null check (char_length(btrim(source_name)) between 1 and 200),
  source_url text not null check (source_url ~ '^https://'),
  last_verified_at date not null,
  status text not null default 'PUBLISHED' check (status in ('PUBLISHED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_products_districts_need_state check (state is not null or districts = '{}')
);

create trigger insurance_products_set_updated_at
  before update on public.insurance_products
  for each row execute function public.set_updated_at();

create table public.insurance_texts (
  product_id uuid not null references public.insurance_products (id) on delete cascade,
  locale text not null check (locale in ('hi', 'en')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  eligibility text not null check (char_length(btrim(eligibility)) between 1 and 3000),
  coverage text not null check (char_length(btrim(coverage)) between 1 and 3000),
  premium text not null check (char_length(btrim(premium)) between 1 and 2000),
  important_dates text check (important_dates is null or char_length(btrim(important_dates)) between 1 and 2000),
  claim_process text not null check (char_length(btrim(claim_process)) between 1 and 3000),
  primary key (product_id, locale)
);

-- Crops covered. Unlike schemes, insurance is always for named crops.
create table public.insurance_crops (
  product_id uuid not null references public.insurance_products (id) on delete cascade,
  crop_id uuid not null references public.crop_catalog (id),
  primary key (product_id, crop_id)
);

-- Creates or updates one product (matched by slug) with its texts and crops, all at once.
create or replace function public.import_insurance_product(p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_product_id uuid;
  loc text;
  t jsonb;
  crop_name text;
  found_crop uuid;
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
  if jsonb_array_length(coalesce(p->'crops', '[]')) = 0 then
    raise exception '%: crops is required (at least one crop)', p->>'slug' using errcode = 'check_violation';
  end if;
  foreach loc in array array['hi', 'en'] loop
    if jsonb_typeof(p->'texts'->loc) is distinct from 'object' then
      raise exception '%: texts.% is required', p->>'slug', loc using errcode = 'check_violation';
    end if;
  end loop;

  insert into public.insurance_products as ip (
    slug, provider, state, districts, seasons, enrollment_deadline,
    official_url, source_name, source_url, last_verified_at, status
  ) values (
    p->>'slug',
    p->>'provider',
    nullif(p->>'state', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p->'districts', '[]'))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p->'seasons', '[]'))), '{}'),
    nullif(p->>'enrollment_deadline', '')::date,
    nullif(p->>'official_url', ''),
    p->>'source_name',
    p->>'source_url',
    (p->>'last_verified_at')::date,
    coalesce(nullif(p->>'status', ''), 'PUBLISHED')
  )
  on conflict (slug) do update set
    provider = excluded.provider,
    state = excluded.state,
    districts = excluded.districts,
    seasons = excluded.seasons,
    enrollment_deadline = excluded.enrollment_deadline,
    official_url = excluded.official_url,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    last_verified_at = excluded.last_verified_at,
    status = excluded.status
  returning ip.id into v_product_id;

  delete from public.insurance_texts x where x.product_id = v_product_id;
  foreach loc in array array['hi', 'en'] loop
    t := p->'texts'->loc;
    insert into public.insurance_texts (product_id, locale, name, summary, eligibility, coverage, premium, important_dates, claim_process)
    values (
      v_product_id, loc, t->>'name', t->>'summary', t->>'eligibility', t->>'coverage', t->>'premium',
      nullif(t->>'important_dates', ''), t->>'claim_process'
    );
  end loop;

  delete from public.insurance_crops x where x.product_id = v_product_id;
  for crop_name in select jsonb_array_elements_text(p->'crops') loop
    select c.id into found_crop from public.crop_catalog c where lower(c.name) = lower(crop_name);
    if found_crop is null then
      raise exception '%: unknown crop "%" (use the English name from the crop catalog)', p->>'slug', crop_name
        using errcode = 'check_violation';
    end if;
    insert into public.insurance_crops (product_id, crop_id) values (v_product_id, found_crop);
  end loop;

  return v_product_id;
end;
$$;

revoke all on function public.import_insurance_product(jsonb) from public, anon, authenticated;
grant execute on function public.import_insurance_product(jsonb) to service_role;

alter table public.insurance_products enable row level security;
alter table public.insurance_texts enable row level security;
alter table public.insurance_crops enable row level security;

revoke all on public.insurance_products, public.insurance_texts, public.insurance_crops from anon, authenticated;
grant select on public.insurance_products, public.insurance_texts, public.insurance_crops to authenticated;

create policy "insurance_products: published, for signed-in users" on public.insurance_products
  for select to authenticated using (status = 'PUBLISHED');
create policy "insurance_texts: of published products" on public.insurance_texts
  for select to authenticated
  using (exists (select 1 from public.insurance_products ip where ip.id = product_id and ip.status = 'PUBLISHED'));
create policy "insurance_crops: of published products" on public.insurance_crops
  for select to authenticated
  using (exists (select 1 from public.insurance_products ip where ip.id = product_id and ip.status = 'PUBLISHED'));
