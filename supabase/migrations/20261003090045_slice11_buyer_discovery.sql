-- Slice 11: buyer discovery. See DATABASE.md sections 14, 15 and USER_WORKFLOWS.md section 14.
--
-- Buyers sign in with their phone like farmers, but a login is either a farmer or a buyer,
-- never both. Buyers publish demand (what they want to buy); farmers browse active demand,
-- call the buyer and can say they are interested, which shares their name, village and phone
-- with that buyer only. Verification of buyers is done by the Kisan 360 team (not by buyers).

-- ---------------------------------------------------------------------------
-- buyers
-- ---------------------------------------------------------------------------

create table public.buyers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  organization_name text check (organization_name is null or char_length(btrim(organization_name)) between 1 and 100),
  -- Copied from the verified login by a trigger; never trusted from the client.
  phone text,
  buyer_type text not null check (buyer_type in ('LOCAL_TRADER', 'MANDI', 'FPO', 'COMPANY', 'OTHER')),
  preferred_language text not null default 'hi' check (preferred_language in ('hi', 'en')),
  state text not null check (char_length(btrim(state)) between 1 and 100),
  district text not null check (char_length(btrim(district)) between 1 and 100),
  -- Town, market or village where the buyer works.
  location text not null check (char_length(btrim(location)) between 1 and 100),
  -- Set only by the Kisan 360 team after checking the buyer (no grant to farmers or buyers).
  verification_status text not null default 'NOT_VERIFIED'
    check (verification_status in ('NOT_VERIFIED', 'VERIFIED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Same rule as for farmers: user_id and phone always come from the signed-in user.
create trigger buyers_enforce_identity
  before insert or update on public.buyers
  for each row execute function public.farmers_enforce_identity();

create trigger buyers_set_updated_at
  before update on public.buyers
  for each row execute function public.set_updated_at();

create or replace function public.current_buyer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id from public.buyers b where b.user_id = auth.uid();
$$;

revoke all on function public.current_buyer_id() from public, anon;
grant execute on function public.current_buyer_id() to authenticated;

-- A login is a farmer or a buyer, never both.
create or replace function public.one_role_per_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'buyers' and exists (select 1 from public.farmers f where f.user_id = new.user_id) then
    raise exception 'This login already has a farmer profile' using errcode = 'check_violation';
  end if;
  if tg_table_name = 'farmers' and exists (select 1 from public.buyers b where b.user_id = new.user_id) then
    raise exception 'This login already has a buyer profile' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger buyers_one_role
  before insert on public.buyers
  for each row execute function public.one_role_per_user();

create trigger farmers_one_role
  before insert on public.farmers
  for each row execute function public.one_role_per_user();

-- ---------------------------------------------------------------------------
-- buyer_demands: what a buyer wants to buy
-- ---------------------------------------------------------------------------

create or replace function public.today_in_india()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

create table public.buyer_demands (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null default public.current_buyer_id()
    references public.buyers (id) on delete cascade,
  crop_id uuid not null references public.crop_catalog (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  quantity_unit text not null check (quantity_unit in ('kg', 'quintal', 'tonne')),
  quantity_kg numeric generated always as (quantity * public.produce_unit_kg(quantity_unit)) stored,
  -- CONFIRMED: the buyer commits to buy. INDICATIVE: interest only, no commitment.
  demand_type text not null check (demand_type in ('CONFIRMED', 'INDICATIVE')),
  quality_requirements text check (quality_requirements is null or char_length(quality_requirements) <= 500),
  required_date date not null,
  state text not null check (char_length(btrim(state)) between 1 and 100),
  district text not null check (char_length(btrim(district)) between 1 and 100),
  location text not null check (char_length(btrim(location)) between 1 and 100),
  -- The buyer collects from the farmer's village.
  pickup_available boolean not null,
  payment_terms text check (payment_terms is null or char_length(payment_terms) <= 300),
  demand_status text not null default 'ACTIVE'
    check (demand_status in ('DRAFT', 'ACTIVE', 'FULFILLED', 'EXPIRED', 'CANCELLED')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buyer_demands_buyer_id_idx on public.buyer_demands (buyer_id);
create index buyer_demands_active_idx on public.buyer_demands (crop_id, required_date) where demand_status = 'ACTIVE';

create trigger buyer_demands_set_updated_at
  before update on public.buyer_demands
  for each row execute function public.set_updated_at();

-- New demand is published (ACTIVE) for a date that has not passed. Afterwards the buyer can
-- only close it, once: FULFILLED (bought what they needed) or CANCELLED.
create or replace function public.buyer_demands_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.demand_status <> 'ACTIVE' then
      raise exception 'New demand must be ACTIVE' using errcode = 'check_violation';
    end if;
    if new.required_date < public.today_in_india() then
      raise exception 'The required date has passed' using errcode = 'check_violation';
    end if;
    new.closed_at := null;
    return new;
  end if;

  if new.demand_status is distinct from old.demand_status then
    if old.demand_status <> 'ACTIVE' or new.demand_status not in ('FULFILLED', 'CANCELLED') then
      raise exception 'Demand cannot change from % to %', old.demand_status, new.demand_status
        using errcode = 'check_violation';
    end if;
    new.closed_at := now();
  else
    new.closed_at := old.closed_at;
  end if;
  return new;
end;
$$;

create trigger buyer_demands_check
  before insert or update on public.buyer_demands
  for each row execute function public.buyer_demands_check();

create or replace function public.owns_demand(p_demand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.buyer_demands d
     where d.id = p_demand_id
       and d.buyer_id = public.current_buyer_id()
  );
$$;

revoke all on function public.owns_demand(uuid) from public, anon;
grant execute on function public.owns_demand(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- demand_interests: a farmer tells a buyer they are interested
-- ---------------------------------------------------------------------------

create table public.demand_interests (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.buyer_demands (id) on delete cascade,
  farmer_id uuid not null default public.current_farmer_id()
    references public.farmers (id) on delete cascade,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (demand_id, farmer_id)
);

create index demand_interests_farmer_id_idx on public.demand_interests (farmer_id);

-- Only for demand that is open and whose date has not passed.
create or replace function public.demand_interests_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  demand public.buyer_demands%rowtype;
begin
  select * into demand from public.buyer_demands d where d.id = new.demand_id;
  if demand.id is null or demand.demand_status <> 'ACTIVE' or demand.required_date < public.today_in_india() then
    raise exception 'This demand is not open' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger demand_interests_check
  before insert on public.demand_interests
  for each row execute function public.demand_interests_check();

-- The farmers interested in one of the signed-in buyer's demands, with the contact details a
-- farmer agreed to share by saying they are interested. Nothing else about the farmer.
create or replace function public.demand_interested_farmers(p_demand_id uuid)
returns table (
  interest_id uuid,
  created_at timestamptz,
  note text,
  full_name text,
  village text,
  district text,
  phone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.created_at, i.note, f.full_name, f.village, f.district, f.phone
    from public.demand_interests i
    join public.farmers f on f.id = i.farmer_id
   where i.demand_id = p_demand_id
     and public.owns_demand(p_demand_id)
   order by i.created_at;
$$;

revoke all on function public.demand_interested_farmers(uuid) from public, anon;
grant execute on function public.demand_interested_farmers(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

alter table public.buyers enable row level security;
alter table public.buyer_demands enable row level security;
alter table public.demand_interests enable row level security;

revoke all on public.buyers, public.buyer_demands, public.demand_interests from anon, authenticated;

grant select on public.buyers to authenticated;
grant insert (name, organization_name, buyer_type, preferred_language, state, district, location)
  on public.buyers to authenticated;
grant update (name, organization_name, buyer_type, preferred_language, state, district, location)
  on public.buyers to authenticated;

grant select on public.buyer_demands to authenticated;
grant insert (crop_id, quantity, quantity_unit, demand_type, quality_requirements, required_date,
              state, district, location, pickup_available, payment_terms)
  on public.buyer_demands to authenticated;
-- After publishing, a buyer can only close their demand.
grant update (demand_status) on public.buyer_demands to authenticated;

grant select on public.demand_interests to authenticated;
grant insert (demand_id, note) on public.demand_interests to authenticated;

-- Buyers: their own profile; farmers can see buyers (to judge and call them).
create policy "buyers: select own profile" on public.buyers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "buyers: farmers see buyers" on public.buyers
  for select to authenticated using ((select public.current_farmer_id()) is not null);
create policy "buyers: insert own profile" on public.buyers
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "buyers: update own profile" on public.buyers
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Demand: the buyer sees all of theirs; farmers see open demand, and demand they responded to.
create policy "buyer_demands: buyers see their own" on public.buyer_demands
  for select to authenticated using (buyer_id = (select public.current_buyer_id()));
create policy "buyer_demands: farmers see open demand and their responses" on public.buyer_demands
  for select to authenticated
  using (
    (select public.current_farmer_id()) is not null
    and (
      demand_status = 'ACTIVE'
      or exists (
        select 1 from public.demand_interests i
         where i.demand_id = buyer_demands.id
           and i.farmer_id = (select public.current_farmer_id())
      )
    )
  );
create policy "buyer_demands: buyers publish" on public.buyer_demands
  for insert to authenticated
  with check ((select public.current_buyer_id()) is not null and buyer_id = (select public.current_buyer_id()));
create policy "buyer_demands: buyers close their own" on public.buyer_demands
  for update to authenticated
  using (buyer_id = (select public.current_buyer_id()))
  with check (buyer_id = (select public.current_buyer_id()));

-- Interests: the farmer sees their own; the buyer sees the ones on their demand (contact
-- details only through demand_interested_farmers()).
create policy "demand_interests: farmers see their own" on public.demand_interests
  for select to authenticated using (farmer_id = (select public.current_farmer_id()));
create policy "demand_interests: buyers see those on their demand" on public.demand_interests
  for select to authenticated using (public.owns_demand(demand_id));
create policy "demand_interests: farmers respond" on public.demand_interests
  for insert to authenticated
  with check ((select public.current_farmer_id()) is not null and farmer_id = (select public.current_farmer_id()));
