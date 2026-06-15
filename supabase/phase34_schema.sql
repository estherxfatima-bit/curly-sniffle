-- Fixes for the "Add a partner" flow on the Partners page.
--
-- 1. profiles RLS only allows reading your own row, so the invite-code
--    lookup and the partner's profile info (for showing their name/tasks)
--    were both invisible to the other user.
-- 2. "partners: own rows" RLS requires auth.uid() = user_id, so the
--    reverse relationship row (user_id = partner's id) could never be
--    inserted directly from the client.
--
-- connect_accountability_partner() is a security-definer function that
-- looks up the code, validates it, and inserts both sides of the
-- relationship in one call, bypassing the RLS restrictions above safely
-- (it only ever acts on behalf of auth.uid() and the resolved partner).

drop function if exists find_user_id_by_invite_code(text);

create or replace function connect_accountability_partner(p_code text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_partner_id uuid;
begin
  select id into v_partner_id from profiles where invite_code = p_code;

  if v_partner_id is null then
    raise exception 'No user found with that code';
  end if;
  if v_partner_id = auth.uid() then
    raise exception 'That is your own code';
  end if;

  insert into accountability_partners (user_id, partner_id, status)
  values (auth.uid(), v_partner_id, 'accepted')
  on conflict (user_id, partner_id) do update set status = 'accepted';

  insert into accountability_partners (user_id, partner_id, status)
  values (v_partner_id, auth.uid(), 'accepted')
  on conflict (user_id, partner_id) do update set status = 'accepted';

  return v_partner_id;
end;
$$;

-- Let accepted partners read each other's profile (for name/email display).
drop policy if exists "profiles: accepted partner read" on profiles;
create policy "profiles: accepted partner read" on profiles
  for select using (
    exists (
      select 1 from accountability_partners
      where accountability_partners.user_id   = auth.uid()
        and accountability_partners.partner_id = profiles.id
        and accountability_partners.status     = 'accepted'
    )
  );
