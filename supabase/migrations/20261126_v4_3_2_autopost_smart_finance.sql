-- Qoomia V4.3.2 — auto-post server-side affidabile, notifiche ricorrenze e Smart Finance.
-- Idempotente: può essere eseguita anche se la migration V4.3.1 è già stata applicata.

create table if not exists public.notification_preferences(
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  budget_enabled boolean not null default true,
  budget_thresholds integer[] not null default array[80],
  goals_enabled boolean not null default true,
  goal_thresholds integer[] not null default array[80],
  recurring_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences add column if not exists recurring_enabled boolean not null default true;

create table if not exists public.push_subscriptions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

create table if not exists public.notification_deliveries(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  kind text not null,
  subject_id text not null,
  period_key text not null,
  threshold integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique(user_id,space_id,kind,subject_id,period_key,threshold)
);

-- Allinea eventuali check creati da patch precedenti che ammettevano soltanto budget/goal.
do $$
declare constraint_row record;
begin
  for constraint_row in
    select conname from pg_constraint
    where conrelid='public.notification_deliveries'::regclass
      and contype='c' and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.notification_deliveries drop constraint %I',constraint_row.conname);
  end loop;
  if not exists(select 1 from pg_constraint where conrelid='public.notification_deliveries'::regclass and conname='notification_deliveries_kind_check') then
    alter table public.notification_deliveries add constraint notification_deliveries_kind_check check(kind in ('budget','goal','recurring'));
  end if;
end $$;

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "notification preferences own select" on public.notification_preferences;
create policy "notification preferences own select" on public.notification_preferences for select to authenticated using(user_id=auth.uid());
drop policy if exists "notification preferences own insert" on public.notification_preferences;
create policy "notification preferences own insert" on public.notification_preferences for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "notification preferences own update" on public.notification_preferences;
create policy "notification preferences own update" on public.notification_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- La funzione viene invocata soltanto dalla route Cron con la service-role key.
-- Crea ogni occorrenza una sola volta e avanza next_run anche dopo un retry.
create or replace function public.process_due_recurring(p_today date)
returns table(
  recurring_id uuid,
  transaction_id uuid,
  space_id uuid,
  due_date date,
  amount numeric,
  note text,
  category_name text,
  created_by uuid
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_rule public.recurring_transactions%rowtype;
  v_due date;
  v_transaction uuid;
  v_actor uuid;
  v_generated boolean;
  v_guard integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'Unauthorized';
  end if;
  if p_today is null then raise exception 'Data mancante'; end if;

  for v_rule in
    select * from public.recurring_transactions
    where active=true and auto_post=true and next_run<=p_today
    order by next_run,id
    for update skip locked
  loop
    v_due:=v_rule.next_run;
    v_guard:=0;
    v_actor:=coalesce(v_rule.created_by,v_rule.user_id);

    while v_due<=p_today and v_guard<120 loop
      v_guard:=v_guard+1;
      v_transaction:=null;
      v_generated:=false;

      insert into public.transactions(
        user_id,created_by,space_id,source,source_id,recurring_id,recurring_due_date,
        date,category_name,amount,currency,note,account_name
      ) values(
        v_rule.user_id,v_actor,v_rule.space_id,'recurring',v_rule.id::text||':'||v_due::text,
        v_rule.id,v_due,v_due,v_rule.category_name,v_rule.amount,v_rule.currency,v_rule.note,v_rule.account_name
      )
      on conflict (recurring_id,recurring_due_date)
        where recurring_id is not null and recurring_due_date is not null
      do nothing
      returning id into v_transaction;

      if v_transaction is not null then
        v_generated:=true;
      else
        select t.id into v_transaction from public.transactions t
        where t.recurring_id=v_rule.id and t.recurring_due_date=v_due limit 1;
      end if;

      if v_transaction is not null then
        insert into public.recurring_payments(recurring_id,space_id,due_date,amount,transaction_id,confirmed_by)
        values(v_rule.id,v_rule.space_id,v_due,v_rule.amount,v_transaction,v_actor)
        on conflict(recurring_id,due_date) do nothing;
      end if;

      if v_generated then
        recurring_id:=v_rule.id;
        transaction_id:=v_transaction;
        space_id:=v_rule.space_id;
        due_date:=v_due;
        amount:=v_rule.amount;
        note:=v_rule.note;
        category_name:=v_rule.category_name;
        created_by:=v_actor;
        return next;
      end if;

      update public.recurring_transactions
      set last_generated=v_due,
          next_run=public.advance_recurring_date(v_due,v_rule.frequency,v_rule.interval_count)
      where id=v_rule.id;
      v_due:=public.advance_recurring_date(v_due,v_rule.frequency,v_rule.interval_count);
    end loop;
  end loop;
end;
$$;

revoke all on function public.process_due_recurring(date) from public,anon,authenticated;
grant execute on function public.process_due_recurring(date) to service_role;

-- Forza il refresh della cache schema PostgREST dopo nuove colonne/funzioni.
notify pgrst,'reload schema';
