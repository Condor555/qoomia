-- Qoomia V4.3 — auto-post server-side e notifiche delle ricorrenze
-- Incrementale e idempotente. Eseguire una sola volta nel SQL Editor Supabase.

alter table if exists public.notification_preferences
  add column if not exists recurring_enabled boolean not null default true;

-- notification_deliveries usa kind per la deduplicazione. Estende l'eventuale
-- check esistente senza dipendere dal nome che aveva nella migration originaria.
do $$
declare item record;
begin
  if to_regclass('public.notification_deliveries') is not null then
    for item in
      select conname
      from pg_constraint
      where conrelid='public.notification_deliveries'::regclass
        and contype='c'
        and (
          select attnum from pg_attribute
          where attrelid='public.notification_deliveries'::regclass and attname='kind'
        )=any(conkey)
    loop
      execute format('alter table public.notification_deliveries drop constraint %I',item.conname);
    end loop;

    if not exists(
      select 1 from pg_constraint
      where conrelid='public.notification_deliveries'::regclass
        and conname='notification_deliveries_kind_check'
    ) then
      alter table public.notification_deliveries
        add constraint notification_deliveries_kind_check
        check(kind in ('budget','goal','recurring'));
    end if;
  end if;
end $$;

-- Versione server-side della conferma: può essere invocata solo con la service role
-- dal Cron Vercel. Il lock sulla regola e le unique esistenti rendono l'operazione
-- atomica e impediscono movimenti duplicati.
create or replace function public.confirm_recurring_payment_for_cron(
  p_recurring_id uuid,
  p_due_date date
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_rule public.recurring_transactions%rowtype;
  v_actor uuid;
  v_transaction uuid;
  v_payment uuid;
  v_existing uuid;
  v_cursor date;
  v_last date;
  v_guard integer:=0;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Unauthorized'; end if;

  select * into v_rule
  from public.recurring_transactions
  where id=p_recurring_id and active=true and auto_post=true
  for update;

  if v_rule.id is null then
    return jsonb_build_object('status','skipped');
  end if;

  v_actor:=coalesce(v_rule.created_by,v_rule.user_id);
  v_cursor:=v_rule.next_run;
  while v_cursor<p_due_date and v_guard<120 loop
    v_cursor:=public.advance_recurring_date(v_cursor,v_rule.frequency,v_rule.interval_count);
    v_guard:=v_guard+1;
  end loop;
  if v_cursor<>p_due_date then raise exception 'La data non appartiene alla pianificazione'; end if;

  select id into v_existing
  from public.recurring_payments
  where recurring_id=p_recurring_id and due_date=p_due_date;

  if v_existing is not null then
    v_cursor:=v_rule.next_run;v_guard:=0;
    while exists(
      select 1 from public.recurring_payments
      where recurring_id=v_rule.id and due_date=v_cursor
    ) and v_guard<120 loop
      v_last:=v_cursor;
      v_cursor:=public.advance_recurring_date(v_cursor,v_rule.frequency,v_rule.interval_count);
      v_guard:=v_guard+1;
    end loop;
    update public.recurring_transactions
      set last_generated=coalesce(v_last,last_generated),next_run=v_cursor
      where id=v_rule.id;
    return jsonb_build_object('status','already-confirmed','paymentId',v_existing);
  end if;

  insert into public.transactions(
    user_id,created_by,space_id,source,source_id,recurring_id,recurring_due_date,
    date,category_name,amount,currency,note,account_name
  ) values(
    v_actor,v_actor,v_rule.space_id,'recurring',v_rule.id::text||':'||p_due_date::text,
    v_rule.id,p_due_date,p_due_date,v_rule.category_name,v_rule.amount,v_rule.currency,
    v_rule.note,v_rule.account_name
  ) returning id into v_transaction;

  insert into public.recurring_payments(
    recurring_id,space_id,due_date,amount,transaction_id,confirmed_by
  ) values(
    v_rule.id,v_rule.space_id,p_due_date,v_rule.amount,v_transaction,v_actor
  ) returning id into v_payment;

  v_cursor:=v_rule.next_run;v_guard:=0;v_last:=null;
  while exists(
    select 1 from public.recurring_payments
    where recurring_id=v_rule.id and due_date=v_cursor
  ) and v_guard<120 loop
    v_last:=v_cursor;
    v_cursor:=public.advance_recurring_date(v_cursor,v_rule.frequency,v_rule.interval_count);
    v_guard:=v_guard+1;
  end loop;

  update public.recurring_transactions
    set last_generated=coalesce(v_last,last_generated),next_run=v_cursor
    where id=v_rule.id;

  return jsonb_build_object(
    'status','confirmed','paymentId',v_payment,'transactionId',v_transaction
  );
end;
$$;

revoke all on function public.confirm_recurring_payment_for_cron(uuid,date) from public;
revoke all on function public.confirm_recurring_payment_for_cron(uuid,date) from anon;
revoke all on function public.confirm_recurring_payment_for_cron(uuid,date) from authenticated;
grant execute on function public.confirm_recurring_payment_for_cron(uuid,date) to service_role;
