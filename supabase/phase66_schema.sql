-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 66: Learning section + AI context wizard fields
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Profile AI context wizard fields ──────────────────────────────────────

alter table profiles
  add column if not exists ai_context_current_work    text,
  add column if not exists ai_context_background      text,
  add column if not exists ai_context_building        text,
  add column if not exists ai_context_creative_skills text,
  add column if not exists ai_context_level           text,
  add column if not exists ai_context_avoid           text,
  add column if not exists ai_context_summary         text;

-- Pre-populate Esther's (estheras97) profile context
update profiles
set
  ai_context_current_work    = 'Marketing and operations professional, currently Trade Marketing Project Manager at UGG/Deckers, managing integrated campaigns across UK, Germany, France, Benelux.',
  ai_context_background      = 'My journey spans from high-growth scale-ups to established corporations like Siemens, where I''ve consistently improved processes, built systems from scratch, and collaborated across technical and creative teams. Before transitioning into marketing and operations, I have done substantial creative work including with major music labels Sony Music Entertainment and Universal Music Group, delivering content strategies that helped artists grow by millions of followers. I combine analytical rigour with creative problem-solving, whether I''m implementing CRM systems, developing SOPs, or directing a film/shooting.',
  ai_context_building        = 'A portfolio career across three tracks: marketing and operations contracting, freelance creative direction, and a property business called Sanctum.',
  ai_context_creative_skills = 'Film direction and editing (directed Queens Without Crowns, a YouTube Originals documentary with GRM Daily), content strategy, social media growth (created Ghosty campaign for Sony Music France — 4M TikTok followers, fastest-growing French account on the platform at the time).',
  ai_context_level           = 'Experienced professional',
  ai_context_avoid           = 'Don''t suggest beginner fundamentals. Don''t give generic productivity or career advice. Pitch everything at an intermediate to advanced level.',
  ai_context_summary         = 'Esther is an experienced marketing and operations professional (Trade Marketing PM at UGG/Deckers) with a rich background spanning high-growth scale-ups, Siemens, Sony Music, and Universal Music Group. She combines analytical operations rigour with creative direction — she has directed YouTube Originals documentaries and built viral social campaigns (4M TikTok followers for a French artist, fastest-growing French account at the time). She is building a portfolio career across marketing/ops contracting, freelance creative direction, and a property business (Sanctum). Pitch everything at an intermediate-to-advanced level; do not suggest beginner fundamentals or generic advice.'
where id in (
  select id from auth.users where email = 'estheras97@gmail.com'
);

-- ── 2. Learning tracks ───────────────────────────────────────────────────────

create table if not exists learning_tracks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  category        text not null default 'Other',
  why_text        text,
  goal_id         uuid references goals(id) on delete set null,
  status          text not null default 'Not started'
                    check (status in ('Not started','In progress','On hold','Complete')),
  target_date     date,
  curriculum_mode text not null default 'freeform'
                    check (curriculum_mode in ('freeform','structured')),
  private         boolean not null default false,
  notes_text      text,
  created_at      timestamptz default now()
);

alter table learning_tracks enable row level security;

-- Owner: full access
drop policy if exists "learning_tracks: owner" on learning_tracks;
create policy "learning_tracks: owner" on learning_tracks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Accepted partners can read non-private tracks
drop policy if exists "learning_tracks: partner read" on learning_tracks;
create policy "learning_tracks: partner read" on learning_tracks
  for select using (
    private = false
    and is_accepted_partner(user_id)
  );

-- ── 3. Learning resources ─────────────────────────────────────────────────────

create table if not exists learning_resources (
  id          uuid primary key default gen_random_uuid(),
  track_id    uuid not null references learning_tracks(id) on delete cascade,
  title       text not null,
  type        text not null default 'Course'
                check (type in ('Course','Book','Article','Video','Podcast','Tool','Other')),
  url         text,
  platform    text,
  cost        numeric(10,2),
  notes       text,
  created_at  timestamptz default now()
);

alter table learning_resources enable row level security;

-- Owner accesses via track ownership
drop policy if exists "learning_resources: owner" on learning_resources;
create policy "learning_resources: owner" on learning_resources
  for all using (
    exists (select 1 from learning_tracks t where t.id = track_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from learning_tracks t where t.id = track_id and t.user_id = auth.uid())
  );

-- Partners can read resources of non-private tracks they can see
drop policy if exists "learning_resources: partner read" on learning_resources;
create policy "learning_resources: partner read" on learning_resources
  for select using (
    exists (
      select 1 from learning_tracks t
      where t.id = track_id and t.private = false and is_accepted_partner(t.user_id)
    )
  );

-- ── 4. Learning modules (structured mode only) ────────────────────────────────

create table if not exists learning_modules (
  id          uuid primary key default gen_random_uuid(),
  track_id    uuid not null references learning_tracks(id) on delete cascade,
  title       text not null,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz default now()
);

alter table learning_modules enable row level security;

drop policy if exists "learning_modules: owner" on learning_modules;
create policy "learning_modules: owner" on learning_modules
  for all using (
    exists (select 1 from learning_tracks t where t.id = track_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from learning_tracks t where t.id = track_id and t.user_id = auth.uid())
  );

drop policy if exists "learning_modules: partner read" on learning_modules;
create policy "learning_modules: partner read" on learning_modules
  for select using (
    exists (
      select 1 from learning_tracks t
      where t.id = track_id and t.private = false and is_accepted_partner(t.user_id)
    )
  );

-- ── 5. Learning steps / lessons ──────────────────────────────────────────────

create table if not exists learning_steps (
  id               uuid primary key default gen_random_uuid(),
  track_id         uuid not null references learning_tracks(id) on delete cascade,
  module_id        uuid references learning_modules(id) on delete set null,
  title            text not null,
  description      text,
  estimated_minutes integer,
  status           text not null default 'Not started'
                     check (status in ('Not started','In progress','Done')),
  notes            text,
  reflection_notes text,
  sort_order       integer not null default 0,
  is_weekly_focus  boolean not null default false,
  created_at       timestamptz default now()
);

alter table learning_steps enable row level security;

drop policy if exists "learning_steps: owner" on learning_steps;
create policy "learning_steps: owner" on learning_steps
  for all using (
    exists (select 1 from learning_tracks t where t.id = track_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from learning_tracks t where t.id = track_id and t.user_id = auth.uid())
  );

drop policy if exists "learning_steps: partner read" on learning_steps;
create policy "learning_steps: partner read" on learning_steps
  for select using (
    exists (
      select 1 from learning_tracks t
      where t.id = track_id and t.private = false and is_accepted_partner(t.user_id)
    )
  );

-- ── 6. Learning attachments ──────────────────────────────────────────────────

create table if not exists learning_attachments (
  id           uuid primary key default gen_random_uuid(),
  step_id      uuid not null references learning_steps(id) on delete cascade,
  type         text not null check (type in ('image','pdf','url')),
  url          text not null,
  display_name text,
  created_at   timestamptz default now()
);

alter table learning_attachments enable row level security;

drop policy if exists "learning_attachments: owner" on learning_attachments;
create policy "learning_attachments: owner" on learning_attachments
  for all using (
    exists (
      select 1 from learning_steps s
      join learning_tracks t on t.id = s.track_id
      where s.id = step_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from learning_steps s
      join learning_tracks t on t.id = s.track_id
      where s.id = step_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "learning_attachments: partner read" on learning_attachments;
create policy "learning_attachments: partner read" on learning_attachments
  for select using (
    exists (
      select 1 from learning_steps s
      join learning_tracks t on t.id = s.track_id
      where s.id = step_id and t.private = false and is_accepted_partner(t.user_id)
    )
  );
