-- Fix get_partner_budget_adherence to fall back to the 'default' budget
-- template when no explicit budget row exists for the current month.
-- Previously it returned null whenever the partner hadn't opened the budget
-- editor for the specific month, even if they had a default budget set.

create or replace function get_partner_budget_adherence(p_user_id uuid)
returns numeric
language plpgsql
security definer
stable
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_budget numeric;
  v_spent numeric;
begin
  if not is_accepted_partner(p_user_id) then return null; end if;
  if not exists (
    select 1 from user_sharing_settings
    where user_id = p_user_id and share_finance
  ) then
    return null;
  end if;

  -- Try the specific month first, then fall back to the 'default' template.
  select amount into v_budget from budgets
    where user_id = p_user_id and category is null and month_year = v_month
    limit 1;

  if v_budget is null or v_budget = 0 then
    select amount into v_budget from budgets
      where user_id = p_user_id and category is null and month_year = 'default'
      limit 1;
  end if;

  if v_budget is null or v_budget = 0 then return null; end if;

  select coalesce(sum(amount), 0) into v_spent from variable_expenses
    where user_id = p_user_id and to_char(date, 'YYYY-MM') = v_month;

  return round((v_spent / v_budget) * 100, 1);
end;
$$;
