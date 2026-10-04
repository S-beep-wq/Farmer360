-- Slice 19: data-use notice and consent. See DATABASE.md section 21a and docs/FIELD_READINESS.md.
--
-- Every signed-in person (farmer, buyer, or someone not yet registered) must accept the current
-- version of the data-use notice (/privacy) before using the app. Each acceptance is one row: the
-- notice version, the language it was shown in and when. Rows are never changed or deleted by the
-- user, so there is a record of what was agreed to; they go away with the login when the account
-- is deleted. Withdrawing consent is done by deleting the account.

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The version of the notice that was shown, e.g. "2026-10-04". Set in the application.
  notice_version text not null check (notice_version ~ '^[0-9A-Za-z][0-9A-Za-z.-]{0,39}$'),
  -- The language the notice was shown in.
  locale text not null check (locale in ('hi', 'en')),
  accepted_at timestamptz not null default now(),
  constraint user_consents_one_per_version unique (user_id, notice_version)
);

alter table public.user_consents enable row level security;
revoke all on public.user_consents from anon, authenticated;

grant select on public.user_consents to authenticated;
-- Only the version and language can be given; who and when come from the session and the clock.
grant insert (notice_version, locale) on public.user_consents to authenticated;

create policy "user_consents: select own" on public.user_consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_consents: insert own" on public.user_consents
  for insert to authenticated with check (user_id = (select auth.uid()));
