-- Qoomia V4.1.4 — indici per liste, filtri e ricerca dei movimenti.
-- Idempotente: può essere eseguita una sola volta in Supabase SQL Editor.

create extension if not exists pg_trgm;

create index if not exists transactions_space_date_created_idx
  on public.transactions (space_id, date desc, created_at desc);

create index if not exists transactions_space_category_date_idx
  on public.transactions (space_id, category_name, date desc);

create index if not exists transactions_space_author_date_idx
  on public.transactions (space_id, created_by, date desc);

create index if not exists transactions_note_trgm_idx
  on public.transactions using gin (note gin_trgm_ops);

analyze public.transactions;
