-- Slice 9: a farmer can delete their account, including their crop photos in storage.
-- See DATABASE.md sections 3, 11, 24 and 26.
--
-- Files in Supabase Storage cannot be removed with SQL (storage.objects is protected), so
-- deletion happens in two steps, both under the farmer's own session:
--   1. The farmer asks for deletion (farmers.deletion_requested_at). Only then may they remove
--      their own photo files, through the Storage API.
--   2. public.delete_my_account() deletes the auth user once no photo files are left. The
--      foreign keys cascade to every row of farmer data.

-- ---------------------------------------------------------------------------
-- farmers.deletion_requested_at: set once, never cleared
-- ---------------------------------------------------------------------------

alter table public.farmers add column deletion_requested_at timestamptz;

create or replace function public.farmers_deletion_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.deletion_requested_at := null;
  elsif old.deletion_requested_at is not null then
    new.deletion_requested_at := old.deletion_requested_at;
  elsif new.deletion_requested_at is not null then
    new.deletion_requested_at := now();
  end if;
  return new;
end;
$$;

create trigger farmers_deletion_request
  before insert or update on public.farmers
  for each row execute function public.farmers_deletion_request();

-- True when the signed-in farmer has asked for their account to be deleted.
create or replace function public.account_deletion_requested()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.farmers f
     where f.user_id = auth.uid()
       and f.deletion_requested_at is not null
  );
$$;

revoke all on function public.account_deletion_requested() from public, anon;
grant execute on function public.account_deletion_requested() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: after asking for deletion, a farmer may list and remove everything in their own
-- top-level folder. Before that, photos stay read-only (slice 8).
-- ---------------------------------------------------------------------------

create policy "crop-photos: farmers deleting their account see all their files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'crop-photos'
    and (storage.foldername(name))[1] = public.current_farmer_id()::text
    and public.account_deletion_requested()
  );

create policy "crop-photos: farmers deleting their account remove their files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'crop-photos'
    and (storage.foldername(name))[1] = public.current_farmer_id()::text
    and public.account_deletion_requested()
  );

-- Every file still in the signed-in farmer's photo folder (to remove through the Storage API).
create or replace function public.account_photo_paths()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'crop-photos'
     and public.current_farmer_id() is not null
     and starts_with(o.name, public.current_farmer_id()::text || '/')
   order by o.name;
$$;

revoke all on function public.account_photo_paths() from public, anon;
grant execute on function public.account_photo_paths() to authenticated;

-- ---------------------------------------------------------------------------
-- delete_my_account(): removes the signed-in user and, by cascade, all their farmer data
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  farmer public.farmers%rowtype;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into farmer from public.farmers f where f.user_id = uid;

  if farmer.id is not null then
    if farmer.deletion_requested_at is null then
      raise exception 'Account deletion has not been requested' using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from storage.objects o
       where o.bucket_id = 'crop-photos'
         and starts_with(o.name, farmer.id::text || '/')
    ) then
      raise exception 'Photos must be removed from storage first' using errcode = 'check_violation';
    end if;
  end if;

  delete from auth.users u where u.id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
