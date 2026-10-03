-- Slice 10: farmers change their own profile. See DATABASE.md section 3.
--
-- Until now farmers had a table-wide UPDATE grant on their own row (triggers already pinned
-- user_id and phone). Editing the profile becomes a real feature, so narrow the grant to the
-- columns a farmer may change; everything else (id, user_id, phone, timestamps) is refused
-- outright instead of being silently overwritten.

revoke update on public.farmers from authenticated;

grant update (full_name, preferred_language, state, district, village, deletion_requested_at)
  on public.farmers to authenticated;
