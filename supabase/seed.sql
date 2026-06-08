-- Life OS — content seed data
-- Run AFTER schema.sql in Supabase SQL editor
-- Replace 'YOUR_USER_ID' with your actual auth.users id (found in Supabase Auth > Users)

do $$
declare
  uid uuid := 'YOUR_USER_ID'; -- <-- replace this
  b1 uuid;
  b2 uuid;
  b3 uuid;
  b4 uuid;
begin

-- =====================
-- CONTENT BATCHES
-- =====================
insert into content_batches (user_id, name, description) values
  (uid, 'Batch 1', 'Reintro, DITL, lifestyle'),
  (uid, 'Batch 2', 'Portfolio career deep dive'),
  (uid, 'Batch 3', 'Creative direction era'),
  (uid, 'Batch 4', 'Morning editions & creative life')
returning id into b1;

-- Re-query the batch IDs (since we only captured last insert above)
select id into b1 from content_batches where user_id = uid and name = 'Batch 1';
select id into b2 from content_batches where user_id = uid and name = 'Batch 2';
select id into b3 from content_batches where user_id = uid and name = 'Batch 3';
select id into b4 from content_batches where user_id = uid and name = 'Batch 4';

-- =====================
-- CONTENT IDEAS — Batch 1
-- =====================
insert into content_ideas (user_id, title, pillar, format, status, batch, production_stage) values
  (uid, 'Reintroduce myself', 'Work & Becoming', 'Talking head', 'Film next', 'Batch 1', 'Idea'),
  (uid, 'DITL 12.04', 'Life Design', 'Video anchor', 'Ready to edit', 'Batch 1', 'Filmed'),
  (uid, 'When your best friend is your business partner', 'Work & Becoming', 'Simple text over clip', 'Pull clip', 'Batch 1', 'Idea'),
  (uid, 'This week''s reads', 'Taste & Expression', 'Carousel', 'Film next', 'Batch 1', 'Idea'),
  (uid, 'GRWM makeup & hair', 'Taste & Expression', 'Video anchor', 'Film next', 'Batch 1', 'Idea'),
  (uid, 'You''ve perfected your base routine', 'Taste & Expression', 'Simple text over clip', 'Pull clip', 'Batch 1', 'Idea'),
  (uid, 'Hobby maxxing', 'Life Design', 'Simple text over clip', 'Idea', 'Batch 1', 'Idea'),
  (uid, 'Things I learnt while building my Airbnb business', 'Work & Becoming', 'Carousel', 'Idea', 'Batch 1', 'Idea');

-- =====================
-- CONTENT IDEAS — Batch 2
-- =====================
insert into content_ideas (user_id, title, pillar, format, status, batch, production_stage, series) values
  (uid, 'Products I got — Creative direct your life series', 'Taste & Expression', 'Carousel', 'Pull clip', 'Batch 2', 'Idea', 'Creative Direct Your Life'),
  (uid, 'What building a portfolio career taught me', 'Work & Becoming', 'Carousel', 'Idea', 'Batch 2', 'Idea', null),
  (uid, 'Fashion shopping as self-direction becoming your own muse series ep 2', 'Taste & Expression', 'Video anchor', 'Idea', 'Batch 2', 'Idea', 'Becoming Your Own Muse'),
  (uid, '5-9 before the 9-5 PM edition', 'Work & Becoming', 'Video anchor', 'Idea', 'Batch 2', 'Idea', '5-9 Before the 9-5'),
  (uid, 'Mission to become the best version of myself', 'Work & Becoming', 'Video anchor', 'Idea', 'Batch 2', 'Idea', null),
  (uid, 'The portfolio career starter pack', 'Work & Becoming', 'Carousel', 'Idea', 'Batch 2', 'Idea', null),
  (uid, 'Why I stopped trying to have one job title', 'Work & Becoming', 'Talking head', 'Idea', 'Batch 2', 'Idea', null),
  (uid, 'Things I do differently since designing my own career', 'Life Design', 'Carousel', 'Idea', 'Batch 2', 'Idea', null),
  (uid, 'Community callout', 'Work & Becoming', 'Carousel', 'Idea', 'Batch 2', 'Idea', null);

-- =====================
-- CONTENT IDEAS — Batch 3
-- =====================
insert into content_ideas (user_id, title, pillar, format, status, batch, production_stage, series) values
  (uid, 'Creative direct your life makeup era blue mascara glitter experimental colour series ep 1', 'Taste & Expression', 'Video anchor', 'Film next', 'Batch 3', 'Idea', 'Creative Direct Your Life Makeup Era'),
  (uid, 'What I wish I knew before going freelance', 'Work & Becoming', 'Carousel', 'Idea', 'Batch 3', 'Idea', null),
  (uid, 'Consistency over perfection', 'Work & Becoming', 'Simple text over clip', 'Film next', 'Batch 3', 'Idea', null),
  (uid, 'How I manage 3 income streams at once', 'Work & Becoming', 'Carousel', 'Idea', 'Batch 3', 'Idea', null);

-- =====================
-- CONTENT IDEAS — Batch 4
-- =====================
insert into content_ideas (user_id, title, pillar, format, status, batch, production_stage, series) values
  (uid, '5-9 before the 9-5 AM edition', 'Work & Becoming', 'Video anchor', 'Idea', 'Batch 4', 'Idea', '5-9 Before the 9-5'),
  (uid, 'Creative direction for your everyday life series ep 4', 'Taste & Expression', 'Talking head', 'Idea', 'Batch 4', 'Idea', 'Creative Direction For Your Everyday Life'),
  (uid, 'A week of outfits five contexts', 'Taste & Expression', 'Video anchor', 'Idea', 'Batch 4', 'Idea', null),
  (uid, 'How I think about money across multiple income streams', 'Life Design', 'Carousel', 'Idea', 'Batch 4', 'Idea', null),
  (uid, 'Mid to late 20s things I''m figuring out', 'Life Design', 'Talking head', 'Idea', 'Batch 4', 'Idea', null),
  (uid, 'Things I''m doing to build a portfolio career before it pays off', 'Work & Becoming', 'Carousel', 'Idea', 'Batch 4', 'Idea', null);

end $$;
