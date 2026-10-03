-- Slice 16: AI farm assistant (questions about the farm). See DATABASE.md section 20,
-- PRODUCT_SPEC.md section 16 and USER_WORKFLOWS.md section 17.
--
-- Following DATABASE.md section 20 ("Do not unnecessarily store sensitive raw conversations"),
-- only metadata about each question is kept: no question text and no answer text. It is used for
-- the daily limit and for the farmer's "Did this help?" feedback during field validation.

create table public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null default public.current_farmer_id()
    references public.farmers (id) on delete cascade,
  interaction_type text not null check (interaction_type in ('FARM_QUESTION')),
  model text not null check (char_length(model) between 1 and 100),
  confidence text not null check (confidence in ('LOW', 'MEDIUM', 'HIGH')),
  -- The answer asked the farmer for missing information.
  asked_for_information boolean not null,
  see_expert boolean not null,
  -- Whether the question was about one crop (true) or the whole farm.
  about_one_crop boolean not null,
  farmer_feedback text check (farmer_feedback in ('HELPFUL', 'NOT_HELPFUL', 'NOT_SURE')),
  created_at timestamptz not null default now()
);

create index ai_interactions_farmer_id_idx on public.ai_interactions (farmer_id, created_at);

-- At most 30 questions per farmer per day (India time).
create or replace function public.ai_interactions_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.farmer_id is distinct from public.current_farmer_id() then
    raise exception 'Not your record' using errcode = 'insufficient_privilege';
  end if;
  if (
    select count(*) from public.ai_interactions i
     where i.farmer_id = new.farmer_id
       and (i.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
  ) >= 30 then
    raise exception 'question_limit_day' using errcode = 'check_violation';
  end if;
  new.created_at := now();
  new.farmer_feedback := null;
  return new;
end;
$$;

create trigger ai_interactions_check
  before insert on public.ai_interactions
  for each row execute function public.ai_interactions_check();

alter table public.ai_interactions enable row level security;
revoke all on public.ai_interactions from anon, authenticated;

grant select on public.ai_interactions to authenticated;
grant insert (interaction_type, model, confidence, asked_for_information, see_expert, about_one_crop)
  on public.ai_interactions to authenticated;
grant update (farmer_feedback) on public.ai_interactions to authenticated;

create policy "ai_interactions: select own" on public.ai_interactions
  for select to authenticated using (farmer_id = (select public.current_farmer_id()));
create policy "ai_interactions: insert own" on public.ai_interactions
  for insert to authenticated with check (farmer_id = (select public.current_farmer_id()));
create policy "ai_interactions: feedback on own" on public.ai_interactions
  for update to authenticated
  using (farmer_id = (select public.current_farmer_id()))
  with check (farmer_id = (select public.current_farmer_id()));
