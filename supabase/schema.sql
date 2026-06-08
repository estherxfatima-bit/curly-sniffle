-- Life OS — full schema
-- Run in Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =====================
-- PROFILES
-- =====================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  invite_code text unique,
  created_at timestamptz default now()
);

-- RLS: users can only see and edit their own profile
alter table profiles enable row level security;
create policy "profiles: own row read"  on profiles for select using (auth.uid() = id);
create policy "profiles: own row write" on profiles for insert with check (auth.uid() = id);
create policy "profiles: own row update" on profiles for update using (auth.uid() = id);

-- =====================
-- GOALS
-- =====================
create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  primary_goal text not null,
  key_actions text,
  success_metrics text,
  quarter text not null, -- e.g. 'Q2'
  year int not null default extract(year from now())::int,
  created_at timestamptz default now()
);

alter table goals enable row level security;
-- Users can only access their own goals
create policy "goals: own rows" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================
-- WEEKLY TASKS
-- =====================
create table if not exists weekly_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null, -- nullable FK to goals
  week_start date not null,
  area text not null,
  action text,
  frequency text,
  specific_task text not null,
  complete boolean default false,
  carried_forward boolean default false,
  notes text,
  production_stage text, -- used by content pipeline if applicable
  created_at timestamptz default now()
);

alter table weekly_tasks enable row level security;
-- Users can access their own tasks; partners can read (handled via accountability_partners check)
create policy "weekly_tasks: own rows" on weekly_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Partners can read tasks of accepted partners
create policy "weekly_tasks: partner read" on weekly_tasks for select
  using (
    exists (
      select 1 from accountability_partners
      where accountability_partners.user_id = auth.uid()
        and accountability_partners.partner_id = weekly_tasks.user_id
        and accountability_partners.status = 'accepted'
    )
  );

-- =====================
-- HABITS
-- =====================
create table if not exists habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text default '✅',
  created_at timestamptz default now()
);

alter table habits enable row level security;
create policy "habits: own rows" on habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================
-- HABIT LOGS
-- =====================
create table if not exists habit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null,
  created_at timestamptz default now(),
  unique(user_id, habit_id, log_date)
);

alter table habit_logs enable row level security;
create policy "habit_logs: own rows" on habit_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================
-- ACCOUNTABILITY PARTNERS
-- =====================
create table if not exists accountability_partners (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  status text default 'pending', -- 'pending' | 'accepted'
  created_at timestamptz default now(),
  unique(user_id, partner_id)
);

alter table accountability_partners enable row level security;
-- Users can read and create their own partner rows
create policy "partners: own rows" on accountability_partners for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Partners can see the relationship from either side
create policy "partners: partner read" on accountability_partners for select
  using (auth.uid() = partner_id);

-- =====================
-- COMMENTS (nudges)
-- =====================
create table if not exists comments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references weekly_tasks(id) on delete cascade,
  partner_id uuid references auth.users(id),
  content text not null,
  created_at timestamptz default now()
);

alter table comments enable row level security;
-- Comment author can read/write their own comments
create policy "comments: own rows" on comments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Task owner can read nudges left on their tasks
create policy "comments: task owner read" on comments for select
  using (
    exists (
      select 1 from weekly_tasks
      where weekly_tasks.id = comments.task_id
        and weekly_tasks.user_id = auth.uid()
    )
  );

-- =====================
-- WEEKLY REVIEWS
-- =====================
create table if not exists weekly_reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  shipped text,
  didnt_ship text,
  energy_level int check (energy_level between 1 and 5),
  one_win text,
  one_to_drop text,
  ai_summary text,
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

alter table weekly_reviews enable row level security;
create policy "weekly_reviews: own rows" on weekly_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================
-- MOOD LOGS
-- =====================
create table if not exists mood_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood_score int not null check (mood_score between 1 and 5),
  log_date date not null,
  created_at timestamptz default now(),
  unique(user_id, log_date)
);

alter table mood_logs enable row level security;
create policy "mood_logs: own rows" on mood_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================
-- CONTENT INSPIRATION
-- =====================
create table if not exists content_inspiration (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  platform text,
  notes text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

alter table content_inspiration enable row level security;
create policy "content_inspiration: own rows" on content_inspiration for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================
-- CONTENT BATCHES
-- =====================
create table if not exists content_batches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now()
);

alter table content_batches enable row level security;
create policy "content_batches: own rows" on content_batches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================
-- CONTENT IDEAS
-- =====================
create table if not exists content_ideas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  series text,
  pillar text,
  format text,
  status text default 'Idea',
  hook text,
  caption_notes text,
  repurpose_from text,
  batch text,
  posted_date date,
  notes text,
  reference_url text,
  sound text,
  production_stage text default 'Idea',
  filming_notes text,
  editing_checklist jsonb default '{}',
  created_at timestamptz default now()
);

alter table content_ideas enable row level security;
create policy "content_ideas: own rows" on content_ideas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================
-- INDEXES
-- =====================
create index if not exists habit_logs_user_date on habit_logs(user_id, log_date);
create index if not exists mood_logs_user_date on mood_logs(user_id, log_date);
create index if not exists weekly_tasks_user_week on weekly_tasks(user_id, week_start);
create index if not exists content_ideas_user on content_ideas(user_id);
