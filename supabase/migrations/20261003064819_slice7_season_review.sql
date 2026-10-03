-- Slice 7: season review. See DATABASE.md section 8 and USER_WORKFLOWS.md section 16.
--
-- The season review closes a harvested crop (HARVESTED → COMPLETED) with the farmer's notes in
-- crop_cycles.notes. Because a COMPLETED crop and all its records are frozen, its totals cannot
-- change afterwards, so they are calculated (crop_cycle_totals) rather than copied.

-- ---------------------------------------------------------------------------
-- completed_at: when the season was reviewed and closed (set by the database)
-- ---------------------------------------------------------------------------

alter table public.crop_cycles add column completed_at timestamptz;

update public.crop_cycles set completed_at = updated_at where status = 'COMPLETED';

alter table public.crop_cycles
  add constraint crop_cycles_completed_at_matches_status
  check ((status = 'COMPLETED') = (completed_at is not null));

create or replace function public.crop_cycles_check_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('PLANNED', 'ACTIVE') then
      raise exception 'A new crop cycle must be PLANNED or ACTIVE, not %', new.status
        using errcode = 'check_violation';
    end if;
    new.completed_at := null;
    return new;
  end if;

  if old.status in ('CANCELLED', 'COMPLETED') then
    raise exception 'A % crop cycle can no longer be changed', old.status
      using errcode = 'check_violation';
  end if;

  -- A crop cycle stays on the plot it was grown on (its history belongs to that plot).
  if new.plot_id <> old.plot_id then
    raise exception 'A crop cycle cannot be moved to another plot'
      using errcode = 'check_violation';
  end if;

  if new.status <> old.status and (old.status, new.status) not in (
    ('PLANNED', 'ACTIVE'),
    ('PLANNED', 'CANCELLED'),
    ('ACTIVE', 'HARVESTED'),
    ('ACTIVE', 'CANCELLED'),
    ('HARVESTED', 'COMPLETED')
  ) then
    raise exception 'A crop cycle cannot change from % to %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- The close date is always the database's own clock, never sent by the app.
  new.completed_at := case when new.status = 'COMPLETED' then now() else null end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sales: buyers often pay after the season is closed, so the payment status of a sale on a
-- COMPLETED crop can still be updated. Nothing else about it can change.
-- ---------------------------------------------------------------------------

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
    if tg_op = 'UPDATE'
       and (new.buyer_type, new.buyer_name, new.sale_date, new.quantity, new.quantity_unit,
            new.price_per_unit, new.transport_cost, new.other_cost, new.notes, new.deleted_at)
           is not distinct from
           (old.buyer_type, old.buyer_name, old.sale_date, old.quantity, old.quantity_unit,
            old.price_per_unit, old.transport_cost, old.other_cost, old.notes, old.deleted_at) then
      return new; -- only the payment status changed
    end if;
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

-- ---------------------------------------------------------------------------
-- crop_cycle_totals: the money and produce totals of each crop cycle (removed entries excluded).
-- security_invoker: it runs with the caller's rights, so RLS on every underlying table applies
-- and a farmer only ever sees totals for their own crops.
-- ---------------------------------------------------------------------------

create view public.crop_cycle_totals
with (security_invoker = true)
as
select
  c.id as crop_cycle_id,
  coalesce((select sum(a.cost) from public.crop_activities a
             where a.crop_cycle_id = c.id and a.deleted_at is null), 0)::numeric(14, 2) as work_costs,
  coalesce((select sum(e.amount) from public.expenses e
             where e.crop_cycle_id = c.id and e.deleted_at is null), 0)::numeric(14, 2) as expense_total,
  coalesce((select sum(h.quantity * public.produce_unit_kg(h.quantity_unit)) from public.harvests h
             where h.crop_cycle_id = c.id and h.deleted_at is null), 0)::numeric(14, 3) as harvested_kg,
  coalesce((select sum(s.quantity * public.produce_unit_kg(s.quantity_unit))
              from public.sales s join public.harvests h on h.id = s.harvest_id
             where h.crop_cycle_id = c.id and h.deleted_at is null and s.deleted_at is null), 0)::numeric(14, 3) as sold_kg,
  coalesce((select sum(s.gross_amount)
              from public.sales s join public.harvests h on h.id = s.harvest_id
             where h.crop_cycle_id = c.id and h.deleted_at is null and s.deleted_at is null), 0)::numeric(14, 2) as revenue,
  coalesce((select sum(s.transport_cost + s.other_cost)
              from public.sales s join public.harvests h on h.id = s.harvest_id
             where h.crop_cycle_id = c.id and h.deleted_at is null and s.deleted_at is null), 0)::numeric(14, 2) as selling_costs,
  (select count(*) from public.sales s join public.harvests h on h.id = s.harvest_id
    where h.crop_cycle_id = c.id and h.deleted_at is null and s.deleted_at is null
      and s.payment_status <> 'PAID')::integer as unpaid_sales
from public.crop_cycles c;

revoke all on public.crop_cycle_totals from anon, public;
grant select on public.crop_cycle_totals to authenticated;
