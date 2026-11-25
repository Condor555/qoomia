-- Qoomia V4.2 — Backup, Privacy & Portabilità
-- Incrementale, idempotente. Abilita l'eliminazione autonoma e sicura dell'account.
-- I backup JSON e il ripristino usano le policy RLS esistenti e non richiedono nuove tabelle.

create or replace function public.delete_own_account(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_email text;
  v_space record;
  v_successor uuid;
  v_deleted_personal integer:=0;
  v_deleted_shared integer:=0;
  v_transferred_shared integer:=0;
begin
  if v_user is null then raise exception 'Unauthorized'; end if;
  if p_confirmation is distinct from 'ELIMINA' then raise exception 'Conferma non valida'; end if;
  select email into v_email from auth.users where id=v_user;

  -- Gli spazi condivisi con altri membri sopravvivono: proprietà e configurazione
  -- passano a un membro esistente. Gli spazi senza altri membri vengono rimossi.
  for v_space in
    select id from public.spaces where created_by=v_user and type='shared' for update
  loop
    select sm.user_id into v_successor
    from public.space_members sm
    where sm.space_id=v_space.id and sm.user_id<>v_user
    order by case when sm.role='owner' then 0 else 1 end,sm.joined_at,sm.user_id
    limit 1;
    if v_successor is null then
      delete from public.spaces where id=v_space.id;
      v_deleted_shared:=v_deleted_shared+1;
    else
      update public.space_members set role='owner' where space_id=v_space.id and user_id=v_successor;
      update public.spaces set created_by=v_successor where id=v_space.id;
      v_transferred_shared:=v_transferred_shared+1;
    end if;
  end loop;

  -- Lo spazio personale e tutto il suo contenuto appartengono esclusivamente
  -- all'utente e vengono eliminati in cascata.
  with removed as(
    delete from public.spaces where created_by=v_user and type='personal' returning id
  ) select count(*) into v_deleted_personal from removed;

  -- Mantiene integre le configurazioni degli spazi condivisi rimasti, rimuovendo
  -- l'attribuzione all'account che sta per essere cancellato.
  update public.categories item set user_id=space.created_by
    from public.spaces space where item.space_id=space.id and item.user_id=v_user and space.created_by<>v_user;
  update public.budgets item set created_by=space.created_by
    from public.spaces space where item.space_id=space.id and item.created_by=v_user and space.created_by<>v_user;
  update public.budget_macro_categories item set created_by=space.created_by
    from public.spaces space where item.space_id=space.id and item.created_by=v_user and space.created_by<>v_user;
  update public.macro_budget_allocations item set created_by=space.created_by
    from public.spaces space where item.space_id=space.id and item.created_by=v_user and space.created_by<>v_user;
  update public.saving_goals item set created_by=space.created_by
    from public.spaces space where item.space_id=space.id and item.created_by=v_user and space.created_by<>v_user;
  update public.recurring_payments item set confirmed_by=space.created_by
    from public.spaces space where item.space_id=space.id and item.confirmed_by=v_user and space.created_by<>v_user;

  -- Dati personali inseriti dall'utente negli spazi condivisi.
  delete from public.saving_goal_contributions where contributed_by=v_user;
  delete from public.transactions where user_id=v_user or created_by=v_user;
  delete from public.recurring_transactions where user_id=v_user or created_by=v_user;
  delete from public.space_members where user_id=v_user;

  -- La cancellazione dell'utente completa le cascata su profilo, account,
  -- feedback e richieste/voti ancora attribuiti all'account.
  delete from auth.users where id=v_user;
  if found then
    return jsonb_build_object(
      'status','deleted','email',v_email,
      'personalSpacesDeleted',v_deleted_personal,
      'sharedSpacesDeleted',v_deleted_shared,
      'sharedSpacesTransferred',v_transferred_shared
    );
  end if;
  raise exception 'Account non eliminato';
end;
$$;

revoke all on function public.delete_own_account(text) from public;
grant execute on function public.delete_own_account(text) to authenticated;
