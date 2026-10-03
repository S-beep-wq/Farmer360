-- Slice 6: harvests and sales. See DATABASE.md sections 13 and 16.

-- Kilograms in one unit of harvested produce.
create or replace function public.produce_unit_kg(p_unit text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_unit when 'kg' then 1 when 'quintal' then 100 when 'tonne' then 1000 end::numeric;
$$;

-- ---------------------------------------------------------------------------
-- harvests: produce taken from a crop (a crop can be harvested many times)
-- ---------------------------------------------------------------------------

create table public.harvests (
  id uuid primary key default gen_random_uuid(),
  crop_cycle_id uuid not null references public.crop_cycles (id) on delete cascade,
  harvest_date date not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  quantity_unit text not null check (quantity_unit in ('kg', 'quintal', 'tonne')),
  quality_grade text check (quality_grade in ('GOOD', 'AVERAGE', 'POOR')),
  notes text check (notes is null or char_length(notes) <= 1000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index harvests_crop_cycle_id_idx on public.harvests (crop_cycle_id);

create trigger harvests_set_updated_at
  before update on public.harvests
  for each row execute function public.set_updated_at();

-- Stays on its crop; nothing changes once the crop is COMPLETED (shared with activities and expenses).
create trigger harvests_crop_cycle_check
  before insert or update on public.harvests
  for each row execute function public.crop_cycle_records_check();

-- ---------------------------------------------------------------------------
-- sales: produce from a harvest sold to someone
-- ---------------------------------------------------------------------------

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  harvest_id uuid not null references public.harvests (id) on delete cascade,
  -- Who bought it, as the farmer describes it. The marketplace `buyers` table is a later feature.
  buyer_type text not null check (buyer_type in (
    'LOCAL_TRADER', 'MANDI', 'GOVERNMENT_PROCUREMENT', 'FPO', 'COMPANY', 'CONSUMER', 'OTHER'
  )),
  buyer_name text check (buyer_name is null or char_length(btrim(buyer_name)) between 1 and 100),
  sale_date date not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  quantity_unit text not null check (quantity_unit in ('kg', 'quintal', 'tonne')),
  -- Rupees per one quantity_unit.
  price_per_unit numeric(12, 2) not null check (price_per_unit > 0),
  transport_cost numeric(12, 2) not null default 0 check (transport_cost >= 0),
  other_cost numeric(12, 2) not null default 0 check (other_cost >= 0),
  -- Calculated by the database, never sent by the app.
  gross_amount numeric(14, 2) generated always as (round(quantity * price_per_unit, 2)) stored,
  net_amount numeric(14, 2) generated always as (round(quantity * price_per_unit, 2) - transport_cost - other_cost) stored,
  payment_status text not null check (payment_status in ('PENDING', 'PARTIAL', 'PAID')),
  notes text check (notes is null or char_length(notes) <= 1000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sales_harvest_id_idx on public.sales (harvest_id);

create trigger sales_set_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

-- Kilograms sold from a harvest (removed sales excluded), optionally leaving one sale out.
create or replace function public.harvest_sold_kg(p_harvest_id uuid, p_except_sale_id uuid default null)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(s.quantity * public.produce_unit_kg(s.quantity_unit)), 0)
    from public.sales s
   where s.harvest_id = p_harvest_id
     and s.deleted_at is null
     and (p_except_sale_id is null or s.id <> p_except_sale_id);
$$;

-- Harvest rules:
-- * only for a crop that is in the field or harvested, on or after its sowing date;
-- * its quantity cannot drop below what has already been sold;
-- * it cannot be removed while it still has sales.
create or replace function public.harvests_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cycle public.crop_cycles%rowtype;
begin
  select * into cycle from public.crop_cycles c where c.id = new.crop_cycle_id;

  if tg_op = 'INSERT' and cycle.status not in ('ACTIVE', 'HARVESTED') then
    raise exception 'A harvest can only be recorded for a crop in the field or harvested, not %', cycle.status
      using errcode = 'check_violation';
  end if;

  if new.harvest_date < cycle.actual_sowing_date then
    raise exception 'A harvest cannot be before the sowing date'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' then
    if new.deleted_at is not null and old.deleted_at is null
       and public.harvest_sold_kg(new.id) > 0 then
      raise exception 'A harvest with sales cannot be removed'
        using errcode = 'check_violation';
    end if;
    if new.quantity * public.produce_unit_kg(new.quantity_unit) < public.harvest_sold_kg(new.id) then
      raise exception 'A harvest cannot be less than what was sold from it'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger harvests_check
  before insert or update on public.harvests
  for each row execute function public.harvests_check();

-- Sale rules:
-- * stays on its harvest; the harvest must not be removed; the crop must not be COMPLETED;
-- * sold on or after the harvest date;
-- * the total sold cannot exceed the harvest (compared in kg).
create or replace function public.sales_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  harvest public.harvests%rowtype;
  cycle_status text;
begin
  if tg_op = 'UPDATE' and new.harvest_id <> old.harvest_id then
    raise exception 'A sale cannot be moved to another harvest'
      using errcode = 'check_violation';
  end if;

  -- Lock the harvest so two sales saved at the same time cannot together oversell it.
  select * into harvest from public.harvests h where h.id = new.harvest_id for update;
  select c.status into cycle_status from public.crop_cycles c where c.id = harvest.crop_cycle_id;

  if cycle_status = 'COMPLETED' then
    raise exception 'A completed crop cycle can no longer be changed'
      using errcode = 'check_violation';
  end if;

  if new.deleted_at is not null then
    return new; -- removing a sale is always allowed
  end if;

  if harvest.deleted_at is not null then
    raise exception 'A removed harvest cannot have sales'
      using errcode = 'check_violation';
  end if;

  if new.sale_date < harvest.harvest_date then
    raise exception 'A sale cannot be before its harvest'
      using errcode = 'check_violation';
  end if;

  if public.harvest_sold_kg(new.harvest_id, new.id) + new.quantity * public.produce_unit_kg(new.quantity_unit)
     > harvest.quantity * public.produce_unit_kg(harvest.quantity_unit) then
    raise exception 'More cannot be sold than was harvested'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger sales_check
  before insert or update on public.sales
  for each row execute function public.sales_check();

-- ---------------------------------------------------------------------------
-- Row Level Security: only on the signed-in farmer's own crops. No hard delete.
-- ---------------------------------------------------------------------------

create or replace function public.owns_harvest(p_harvest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.harvests h
     where h.id = p_harvest_id
       and public.owns_crop_cycle(h.crop_cycle_id)
  );
$$;

revoke all on function public.owns_harvest(uuid) from public, anon;
grant execute on function public.owns_harvest(uuid) to authenticated;

alter table public.harvests enable row level security;
alter table public.sales enable row level security;

revoke all on public.harvests, public.sales from anon;
revoke delete, truncate on public.harvests, public.sales from authenticated;

create policy "harvests: select on own crops" on public.harvests
  for select to authenticated using (public.owns_crop_cycle(crop_cycle_id));
create policy "harvests: insert on own crops" on public.harvests
  for insert to authenticated with check (public.owns_crop_cycle(crop_cycle_id));
create policy "harvests: update on own crops" on public.harvests
  for update to authenticated
  using (public.owns_crop_cycle(crop_cycle_id))
  with check (public.owns_crop_cycle(crop_cycle_id));

create policy "sales: select on own harvests" on public.sales
  for select to authenticated using (public.owns_harvest(harvest_id));
create policy "sales: insert on own harvests" on public.sales
  for insert to authenticated with check (public.owns_harvest(harvest_id));
create policy "sales: update on own harvests" on public.sales
  for update to authenticated
  using (public.owns_harvest(harvest_id))
  with check (public.owns_harvest(harvest_id));
