-- Slice 5: crop activities (work done) and expenses (costs). See DATABASE.md sections 9, 12 and 24.

-- True when the crop cycle is on one of the signed-in farmer's plots.
create or replace function public.owns_crop_cycle(p_crop_cycle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crop_cycles c
     where c.id = p_crop_cycle_id
       and public.owns_plot(c.plot_id)
  );
$$;

revoke all on function public.owns_crop_cycle(uuid) from public, anon;
grant execute on function public.owns_crop_cycle(uuid) to authenticated;

-- Shared rules for records that belong to a crop cycle:
-- they stay on their crop cycle, and a COMPLETED cycle (season reviewed) is closed.
create or replace function public.crop_cycle_records_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cycle_status text;
begin
  if tg_op = 'UPDATE' and new.crop_cycle_id <> old.crop_cycle_id then
    raise exception 'A record cannot be moved to another crop cycle'
      using errcode = 'check_violation';
  end if;

  select c.status into cycle_status from public.crop_cycles c where c.id = new.crop_cycle_id;
  if cycle_status = 'COMPLETED' then
    raise exception 'A completed crop cycle can no longer be changed'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Units for quantities of work and inputs.
-- kg, quintal, litre, bag, packet: inputs; hour: machine or pump hours; day: worker-days.

-- ---------------------------------------------------------------------------
-- crop_activities
-- ---------------------------------------------------------------------------

create table public.crop_activities (
  id uuid primary key default gen_random_uuid(),
  crop_cycle_id uuid not null references public.crop_cycles (id) on delete cascade,
  activity_type text not null check (activity_type in (
    'LAND_PREPARATION', 'SOWING', 'IRRIGATION', 'FERTILIZATION', 'WEEDING',
    'CROP_PROTECTION', 'LABOUR', 'MACHINERY', 'HARVEST_PREPARATION', 'OTHER'
  )),
  activity_date date not null check (activity_date >= date '2000-01-01'),
  quantity numeric(12, 3) check (quantity > 0),
  quantity_unit text check (quantity_unit in ('kg', 'quintal', 'litre', 'bag', 'packet', 'hour', 'day')),
  -- Cost of doing this work, in rupees, if the farmer paid for it.
  cost numeric(12, 2) check (cost > 0),
  notes text check (notes is null or char_length(notes) <= 1000),
  -- Removed by the farmer (a mistake or duplicate). Kept for history, hidden in the app.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crop_activities_quantity_with_unit check ((quantity is null) = (quantity_unit is null))
);

create index crop_activities_crop_cycle_id_idx on public.crop_activities (crop_cycle_id);

create trigger crop_activities_set_updated_at
  before update on public.crop_activities
  for each row execute function public.set_updated_at();

create trigger crop_activities_check
  before insert or update on public.crop_activities
  for each row execute function public.crop_cycle_records_check();

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  crop_cycle_id uuid not null references public.crop_cycles (id) on delete cascade,
  category text not null check (category in (
    'SEED', 'FERTILIZER', 'CROP_PROTECTION', 'LABOUR', 'MACHINERY', 'IRRIGATION', 'TRANSPORT', 'OTHER'
  )),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  expense_date date not null check (expense_date >= date '2000-01-01'),
  quantity numeric(12, 3) check (quantity > 0),
  quantity_unit text check (quantity_unit in ('kg', 'quintal', 'litre', 'bag', 'packet', 'hour', 'day')),
  vendor text check (vendor is null or char_length(btrim(vendor)) between 1 and 100),
  notes text check (notes is null or char_length(notes) <= 1000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_quantity_with_unit check ((quantity is null) = (quantity_unit is null))
);

create index expenses_crop_cycle_id_idx on public.expenses (crop_cycle_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create trigger expenses_check
  before insert or update on public.expenses
  for each row execute function public.crop_cycle_records_check();

-- ---------------------------------------------------------------------------
-- Row Level Security: only on the signed-in farmer's own crop cycles. No hard delete:
-- removing an entry sets deleted_at (DATABASE.md section 24).
-- ---------------------------------------------------------------------------

alter table public.crop_activities enable row level security;
alter table public.expenses enable row level security;

revoke all on public.crop_activities, public.expenses from anon;
revoke delete, truncate on public.crop_activities, public.expenses from authenticated;

create policy "crop_activities: select on own crops" on public.crop_activities
  for select to authenticated using (public.owns_crop_cycle(crop_cycle_id));
create policy "crop_activities: insert on own crops" on public.crop_activities
  for insert to authenticated with check (public.owns_crop_cycle(crop_cycle_id));
create policy "crop_activities: update on own crops" on public.crop_activities
  for update to authenticated
  using (public.owns_crop_cycle(crop_cycle_id))
  with check (public.owns_crop_cycle(crop_cycle_id));

create policy "expenses: select on own crops" on public.expenses
  for select to authenticated using (public.owns_crop_cycle(crop_cycle_id));
create policy "expenses: insert on own crops" on public.expenses
  for insert to authenticated with check (public.owns_crop_cycle(crop_cycle_id));
create policy "expenses: update on own crops" on public.expenses
  for update to authenticated
  using (public.owns_crop_cycle(crop_cycle_id))
  with check (public.owns_crop_cycle(crop_cycle_id));
