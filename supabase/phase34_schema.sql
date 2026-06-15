-- Look up a user's id by their accountability-partner invite code.
-- profiles RLS only allows reading your own row, so the "Add a partner"
-- flow on the Partners page can't see another user's profile row to
-- resolve their invite code. This security-definer function runs as the
-- function owner, bypassing RLS, and returns only the id (no other
-- profile data is exposed).

create or replace function find_user_id_by_invite_code(p_code text)
returns uuid
language sql
security definer
stable
as $$
  select id from profiles where invite_code = p_code;
$$;
