-- Phase 16: Wellness meals rebuild — single freeform weekly plan,
-- "My Meals" saved recipe library with photos, archive browsing

-- Meal plan: replace per-day jsonb structure with one freeform text block
alter table meal_plans add column if not exists plan_text text not null default '';
update meal_plans set plan_text = coalesce(
  (
    select string_agg(coalesce(value::text, ''), E'\n')
    from jsonb_each_text(coalesce(days, '{}'::jsonb))
  ), ''
) where plan_text = '';
alter table meal_plans drop column if exists days;

alter table meal_plan_archive add column if not exists plan_text text not null default '';
update meal_plan_archive set plan_text = coalesce(
  (
    select string_agg(coalesce(value::text, ''), E'\n')
    from jsonb_each_text(coalesce(days, '{}'::jsonb))
  ), ''
) where plan_text = '';
alter table meal_plan_archive drop column if exists days;

-- Saved meals library
create table if not exists saved_meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  image_url   text,
  ingredients jsonb not null default '[]'::jsonb, -- array of strings, one per ingredient
  created_at  timestamptz default now()
);

alter table saved_meals enable row level security;

create policy "saved_meals: owner" on saved_meals for all using (auth.uid() = user_id);

-- Supabase storage: meal-images bucket
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

create policy "meal-images: authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-images');

create policy "meal-images: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'meal-images' and owner = auth.uid());

create policy "meal-images: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'meal-images' and owner = auth.uid());

create policy "meal-images: public read"
  on storage.objects for select
  using (bucket_id = 'meal-images');
