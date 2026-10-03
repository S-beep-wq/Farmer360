-- Slice 4: crop status changes. See DATABASE.md section 8.
--
-- Allowed status changes:
--   PLANNED   → ACTIVE      (sowing recorded)
--   PLANNED   → CANCELLED
--   ACTIVE    → HARVESTED   (harvest finished)
--   ACTIVE    → CANCELLED   (for example, the crop was lost)
--   HARVESTED → COMPLETED   (season review; not built yet)
-- CANCELLED and COMPLETED cycles are final and can no longer be changed.

-- A harvested (or completed) crop has a harvest date; no other crop does.
alter table public.crop_cycles
  add constraint crop_cycles_harvest_matches_status
  check ((status in ('HARVESTED', 'COMPLETED')) = (actual_harvest_date is not null));

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

  return new;
end;
$$;

create trigger crop_cycles_check_status_change
  before insert or update on public.crop_cycles
  for each row execute function public.crop_cycles_check_status_change();
