-- Slice 15: AI crop-health assistance on observations. See DATABASE.md sections 10 and 10a,
-- PRODUCT_SPEC.md section 16 and USER_WORKFLOWS.md sections 8 and 18.
--
-- An AI analysis is a separate record linked to the observation. It never changes the farmer's
-- own observation (USER_WORKFLOWS.md section 8: "AI analysis must not overwrite the original
-- farmer observation"). The farmer asks for it explicitly; each request sends their photo to the
-- AI service, so there are limits per observation and per day (cost and misuse control).

create table public.crop_health_analyses (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.crop_observations (id) on delete cascade,
  -- Language the analysis was written in.
  locale text not null check (locale in ('hi', 'en')),
  -- The model that produced it (provenance).
  model text not null check (char_length(model) between 1 and 100),
  -- The structured result, as validated by the application (see src/features/crop-health-ai).
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and result ? 'summary'
    and result ? 'possible_causes'
    and jsonb_typeof(result->'possible_causes') = 'array'
  ),
  confidence text not null check (confidence in ('LOW', 'MEDIUM', 'HIGH')),
  image_usable boolean not null,
  see_expert boolean not null,
  -- The farmer's verdict, for validating the AI in the field.
  farmer_feedback text check (farmer_feedback in ('HELPFUL', 'NOT_HELPFUL', 'NOT_SURE')),
  created_at timestamptz not null default now()
);

create index crop_health_analyses_observation_id_idx on public.crop_health_analyses (observation_id);

-- At most this many analyses per observation, and per farmer per day (India time).
create or replace function public.crop_health_analyses_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  obs public.crop_observations%rowtype;
  farmer uuid := public.current_farmer_id();
begin
  -- Ownership first, so nothing about another farmer's observation is revealed.
  if not public.owns_observation(new.observation_id) then
    raise exception 'Not your observation' using errcode = 'insufficient_privilege';
  end if;
  select * into obs from public.crop_observations o where o.id = new.observation_id;
  if obs.id is null or obs.deleted_at is not null then
    raise exception 'The observation does not exist' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.crop_photos p where p.observation_id = obs.id) then
    raise exception 'Only observations with a photo can be analysed' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.crop_health_analyses a where a.observation_id = obs.id) >= 3 then
    raise exception 'analysis_limit_observation' using errcode = 'check_violation';
  end if;
  if (
    select count(*)
      from public.crop_health_analyses a
      join public.crop_observations o on o.id = a.observation_id
      join public.crop_cycles c on c.id = o.crop_cycle_id
      join public.plots p on p.id = c.plot_id
      join public.farms f on f.id = p.farm_id
     where f.farmer_id = farmer
       and (a.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
  ) >= 20 then
    raise exception 'analysis_limit_day' using errcode = 'check_violation';
  end if;
  new.created_at := now();
  new.farmer_feedback := null;
  return new;
end;
$$;

create trigger crop_health_analyses_check
  before insert on public.crop_health_analyses
  for each row execute function public.crop_health_analyses_check();

alter table public.crop_health_analyses enable row level security;
revoke all on public.crop_health_analyses from anon, authenticated;

grant select on public.crop_health_analyses to authenticated;
grant insert (observation_id, locale, model, result, confidence, image_usable, see_expert)
  on public.crop_health_analyses to authenticated;
-- After saving, the farmer can only say whether it helped.
grant update (farmer_feedback) on public.crop_health_analyses to authenticated;

create policy "crop_health_analyses: select on own observations" on public.crop_health_analyses
  for select to authenticated using (public.owns_observation(observation_id));
create policy "crop_health_analyses: insert on own observations" on public.crop_health_analyses
  for insert to authenticated with check (public.owns_observation(observation_id));
create policy "crop_health_analyses: feedback on own observations" on public.crop_health_analyses
  for update to authenticated
  using (public.owns_observation(observation_id))
  with check (public.owns_observation(observation_id));
