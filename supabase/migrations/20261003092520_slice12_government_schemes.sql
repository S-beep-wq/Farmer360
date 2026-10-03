-- Slice 12: government scheme information. See DATABASE.md section 17, PRODUCT_SPEC.md section 12
-- and USER_WORKFLOWS.md section 10.
--
-- Scheme information is official external data, kept apart from farmer data
-- (SYSTEM_ARCHITECTURE.md section 12). Farmers can only read it. The Kisan 360 team loads it
-- after checking it against the official source, with public.import_scheme() (service role
-- only; see docs/SCHEMES.md). Every scheme must name its source and the date it was checked.

create table public.government_schemes (
  id uuid primary key default gen_random_uuid(),
  -- Stable key used when the team updates a scheme.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  department text not null check (char_length(btrim(department)) between 1 and 200),
  -- Null: applies across India. Otherwise the state, and optionally some of its districts
  -- (empty: the whole state).
  state text check (state is null or char_length(btrim(state)) between 1 and 100),
  districts text[] not null default '{}',
  -- Empty: any season.
  seasons text[] not null default '{}' check (seasons <@ array['kharif', 'rabi', 'zaid']),
  -- Null: no deadline announced (open all year, or check the official source).
  application_deadline date,
  official_url text check (official_url is null or official_url ~ '^https://'),
  source_name text not null check (char_length(btrim(source_name)) between 1 and 200),
  source_url text not null check (source_url ~ '^https://'),
  last_verified_at date not null,
  status text not null default 'PUBLISHED' check (status in ('PUBLISHED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint government_schemes_districts_need_state check (state is not null or districts = '{}')
);

create trigger government_schemes_set_updated_at
  before update on public.government_schemes
  for each row execute function public.set_updated_at();

-- The scheme's text in each language (both Hindi and English are required by import_scheme()).
create table public.scheme_texts (
  scheme_id uuid not null references public.government_schemes (id) on delete cascade,
  locale text not null check (locale in ('hi', 'en')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  eligibility text not null check (char_length(btrim(eligibility)) between 1 and 3000),
  benefit text not null check (char_length(btrim(benefit)) between 1 and 2000),
  required_documents text[] not null default '{}',
  how_to_apply text not null check (char_length(btrim(how_to_apply)) between 1 and 3000),
  primary key (scheme_id, locale)
);

-- Crops a scheme is for. None: any crop.
create table public.scheme_crops (
  scheme_id uuid not null references public.government_schemes (id) on delete cascade,
  crop_id uuid not null references public.crop_catalog (id),
  primary key (scheme_id, crop_id)
);

-- ---------------------------------------------------------------------------
-- Loading schemes (team only)
-- ---------------------------------------------------------------------------

-- Creates or updates one scheme (matched by slug) with its texts and crops, all at once.
-- See docs/SCHEMES.md for the format. Errors name the field that is wrong.
create or replace function public.import_scheme(p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_scheme_id uuid;
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
  foreach loc in array array['hi', 'en'] loop
    if jsonb_typeof(p->'texts'->loc) is distinct from 'object' then
      raise exception '%: texts.% is required', p->>'slug', loc using errcode = 'check_violation';
    end if;
  end loop;

  insert into public.government_schemes as s (
    slug, department, state, districts, seasons, application_deadline,
    official_url, source_name, source_url, last_verified_at, status
  ) values (
    p->>'slug',
    p->>'department',
    nullif(p->>'state', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p->'districts', '[]'))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p->'seasons', '[]'))), '{}'),
    nullif(p->>'application_deadline', '')::date,
    nullif(p->>'official_url', ''),
    p->>'source_name',
    p->>'source_url',
    (p->>'last_verified_at')::date,
    coalesce(nullif(p->>'status', ''), 'PUBLISHED')
  )
  on conflict (slug) do update set
    department = excluded.department,
    state = excluded.state,
    districts = excluded.districts,
    seasons = excluded.seasons,
    application_deadline = excluded.application_deadline,
    official_url = excluded.official_url,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    last_verified_at = excluded.last_verified_at,
    status = excluded.status
  returning s.id into v_scheme_id;

  delete from public.scheme_texts x where x.scheme_id = v_scheme_id;
  foreach loc in array array['hi', 'en'] loop
    t := p->'texts'->loc;
    insert into public.scheme_texts (scheme_id, locale, name, summary, eligibility, benefit, required_documents, how_to_apply)
    values (
      v_scheme_id, loc, t->>'name', t->>'summary', t->>'eligibility', t->>'benefit',
      coalesce(array(select jsonb_array_elements_text(coalesce(t->'required_documents', '[]'))), '{}'),
      t->>'how_to_apply'
    );
  end loop;

  delete from public.scheme_crops x where x.scheme_id = v_scheme_id;
  for crop_name in select jsonb_array_elements_text(coalesce(p->'crops', '[]')) loop
    select c.id into found_crop from public.crop_catalog c where lower(c.name) = lower(crop_name);
    if found_crop is null then
      raise exception '%: unknown crop "%" (use the English name from the crop catalog)', p->>'slug', crop_name
        using errcode = 'check_violation';
    end if;
    insert into public.scheme_crops (scheme_id, crop_id) values (v_scheme_id, found_crop);
  end loop;

  return v_scheme_id;
end;
$$;

revoke all on function public.import_scheme(jsonb) from public, anon, authenticated;
grant execute on function public.import_scheme(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security: signed-in users read published schemes; nobody writes through the API
-- ---------------------------------------------------------------------------

alter table public.government_schemes enable row level security;
alter table public.scheme_texts enable row level security;
alter table public.scheme_crops enable row level security;

revoke all on public.government_schemes, public.scheme_texts, public.scheme_crops from anon, authenticated;
grant select on public.government_schemes, public.scheme_texts, public.scheme_crops to authenticated;

create policy "government_schemes: published, for signed-in users" on public.government_schemes
  for select to authenticated using (status = 'PUBLISHED');
create policy "scheme_texts: of published schemes" on public.scheme_texts
  for select to authenticated
  using (exists (select 1 from public.government_schemes s where s.id = scheme_id and s.status = 'PUBLISHED'));
create policy "scheme_crops: of published schemes" on public.scheme_crops
  for select to authenticated
  using (exists (select 1 from public.government_schemes s where s.id = scheme_id and s.status = 'PUBLISHED'));
