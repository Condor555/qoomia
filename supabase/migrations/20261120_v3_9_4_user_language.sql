-- Le Mie Spese V3.9.4 — preferenza lingua per utente.
-- Incrementale e idempotente: Italiano rimane default/fallback.

alter table public.profiles
  add column if not exists language text not null default 'it';

update public.profiles set language='it' where language is null or language not in ('it','en');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_language_check'
  ) then
    alter table public.profiles
      add constraint profiles_language_check check(language in ('it','en'));
  end if;
end $$;

comment on column public.profiles.language is
  'Locale UI persistito per utente: it (default/fallback) oppure en.';

-- Nessuna policy aggiuntiva: le policy profiles esistenti consentono a ciascun
-- utente di inserire/aggiornare solo la propria riga e di leggere i profili
-- condivisi secondo il modello multiutente già in uso.
