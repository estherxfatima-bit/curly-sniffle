-- Phase 20: Books wishlist + reviews/ratings/notes.
-- status now: wishlist | reading | paused | completed

alter table books
  add column if not exists rating  integer check (rating between 1 and 5),
  add column if not exists review  text,
  add column if not exists notes   text;

comment on column books.status is 'wishlist | reading | paused | completed';
