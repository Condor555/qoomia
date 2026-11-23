'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import AmountExpressionInput from '../../components/AmountExpressionInput';
import AdaptiveSheet from '../../components/AdaptiveSheet';
import Icon from '../../components/Icon';
import CategoryIcon from '../../components/CategoryIcon';
import DateRangePicker,{type DateRange} from '../../components/DateRangePicker';
import MovementFilterDropdown from '../../components/MovementFilterDropdown';
import {onActiveSpaceChanged} from '../../lib/active-space-client';
import {amountForSave} from '../../lib/amount-expression';
import {useI18n} from '../../components/LanguageProvider';

type Transaction={
  id:string;
  date:string;
  category_name:string;
  amount:number;
  currency?:string;
  note:string;
  account_name:string;
  source?:string;
  source_id?:string;
  recurring_id?:string|null;
  created_by?:string|null;
  author_name?:string;
};
type Category={name:string;kind:'expense'|'income';icon?:string;color?:string};
type Member={userId:string;name:string};
type Kind='expense'|'income';
type Scope='occurrence'|'series';
type ModalView='detail'|'edit'|'delete';

export default function Movimenti(){
  const {currency,date:formatDate,t}=useI18n();
  const [rows,setRows]=useState<Transaction[]>([]);
  const [categories,setCategories]=useState<Category[]>([]);
  const [members,setMembers]=useState<Member[]>([]);
  const [q,setQ]=useState('');
  const [debouncedQ,setDebouncedQ]=useState('');
  const [periodStart,setPeriodStart]=useState('');
  const [periodEnd,setPeriodEnd]=useState('');
  const [categoryFilter,setCategoryFilter]=useState('');
  const [kindFilter,setKindFilter]=useState('');
  const [author,setAuthor]=useState('');
  const [spaceId,setSpaceId]=useState('');
  const [page,setPage]=useState(1);
  const [count,setCount]=useState(0);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [reloadToken,setReloadToken]=useState(0);

  const [editing,setEditing]=useState<Transaction|null>(null);
  const [modalView,setModalView]=useState<ModalView>('detail');
  const [date,setDate]=useState('');
  const [category,setCategory]=useState('');
  const [amount,setAmount]=useState('');
  const [note,setNote]=useState('');
  const [account,setAccount]=useState('');
  const [kind,setKind]=useState<Kind>('expense');
  const [scope,setScope]=useState<Scope>('occurrence');
  const [busy,setBusy]=useState(false);
  const [modalMsg,setModalMsg]=useState('');
  const listRequestRef=useRef(0);
  const metadataRequestRef=useRef(0);
  const listAbortRef=useRef<AbortController|null>(null);

  async function loadMetadata(targetSpaceId?:string){
    const request=++metadataRequestRef.current;
    const suffix=targetSpaceId?`?spaceId=${encodeURIComponent(targetSpaceId)}`:'';
    try{
      const [categoryResponse,memberResponse]=await Promise.all([
        fetch(`/api/categories${suffix}`,{cache:'no-store'}),
        fetch(`/api/members${suffix}`,{cache:'no-store'}),
      ]);
      const [categoryResult,memberResult]=await Promise.all([categoryResponse.json(),memberResponse.json()]);
      if(request!==metadataRequestRef.current)return;
      setCategories(categoryResult.data||[]);
      setMembers(memberResult.data||[]);
    }catch{if(request===metadataRequestRef.current){setCategories([]);setMembers([])}}
  }

  useEffect(()=>{
    const timer=window.setTimeout(()=>{setDebouncedQ(q.trim());setPage(1)},300);
    return()=>window.clearTimeout(timer);
  },[q]);

  useEffect(()=>{
    const request=++listRequestRef.current;
    listAbortRef.current?.abort();
    const controller=new AbortController();listAbortRef.current=controller;
    const params=new URLSearchParams({page:String(page)});
    if(debouncedQ)params.set('q',debouncedQ);
    if(periodStart)params.set('start',periodStart);
    if(periodEnd)params.set('end',periodEnd);
    if(author)params.set('author',author);
    if(categoryFilter)params.set('category',categoryFilter);
    if(kindFilter)params.set('kind',kindFilter);
    if(spaceId)params.set('spaceId',spaceId);
    setLoading(true);setError('');
    fetch(`/api/transactions?${params}`,{cache:'no-store',signal:controller.signal})
      .then(async response=>({response,result:await response.json()}))
      .then(({response,result})=>{
        if(request!==listRequestRef.current)return;
        if(!response.ok)throw new Error(result.error||'Impossibile caricare i movimenti.');
        const nextRows:Array<Transaction>=Array.isArray(result.data)?result.data:[];
        setRows(current=>page===1?nextRows:[...current,...nextRows.filter(row=>!current.some(item=>item.id===row.id))]);setCount(Number(result.count||0));
      })
      .catch(error=>{if(error?.name!=='AbortError'&&request===listRequestRef.current){if(page===1){setRows([]);setCount(0)}setError(error?.message||'Errore di connessione.')}})
      .finally(()=>{if(request===listRequestRef.current)setLoading(false)});
    return()=>controller.abort();
  },[debouncedQ,periodStart,periodEnd,author,categoryFilter,kindFilter,page,spaceId,reloadToken]);

  useEffect(()=>{loadMetadata()},[]);
  useEffect(()=>onActiveSpaceChanged(id=>{
    listRequestRef.current++;listAbortRef.current?.abort();metadataRequestRef.current++;
    setSpaceId(id);setRows([]);setCount(0);setPage(1);setAuthor('');setCategoryFilter('');setEditing(null);void loadMetadata(id);
  }),[]);

  function changeRange(range:DateRange){setPeriodStart(range.start);setPeriodEnd(range.end);setPage(1)}
  const hasFilters=Boolean(q||periodStart||periodEnd||author||categoryFilter||kindFilter);
  function clearFilters(){setQ('');setDebouncedQ('');setPeriodStart('');setPeriodEnd('');setAuthor('');setCategoryFilter('');setKindFilter('');setPage(1)}
  function refresh(){setPage(1);setReloadToken(value=>value+1)}

  const groups=useMemo(()=>rows.reduce<Record<string,Transaction[]>>((all,row)=>{
    (all[row.date]||=[]).push(row);
    return all;
  },{}),[rows]);
  const categoryOptions=useMemo(()=>[
    {value:'',label:t('movements.allCategories')},
    ...categories.map(item=>({value:item.name,label:item.name})),
  ],[categories,t]);
  const kindOptions=useMemo(()=>[
    {value:'',label:t('movements.allTypes')},
    {value:'expense',label:t('common.expenses')},
    {value:'income',label:t('common.incomes')},
  ],[t]);

  function categoryData(name:string){
    return categories.find(item=>item.name===name);
  }

  function open(row:Transaction){
    setEditing(row);
    setDate(row.date);
    setCategory(row.category_name);
    setAmount(String(Math.abs(Number(row.amount))).replace('.',','));
    setNote(row.note||'');
    setAccount(row.account_name||'Spese');
    setKind(Number(row.amount)<0?'expense':'income');
    setScope('occurrence');
    setModalView('detail');
    setModalMsg('');
  }

  function closeModal(){
    setEditing(null);
    setModalView('detail');
    setModalMsg('');
  }

  const recurring=editing?.source==='recurring'&&Boolean(editing.recurring_id||editing.source_id);
  const activeCategory=editing?categoryData(editing.category_name):undefined;
  const editCategories=categories.filter(item=>item.kind===kind);
  function changeEditKind(next:Kind){if(next===kind)return;setKind(next);setCategory(categories.find(item=>item.kind===next)?.name||'');}

  async function save(){
    if(!editing)return;
    const numeric=amountForSave(amount);
    if(numeric===null){
      setModalMsg('Inserisci un importo o un calcolo valido maggiore di zero.');
      return;
    }
    if(!category){
      setModalMsg('Seleziona una categoria.');
      return;
    }
    setBusy(true);
    setModalMsg('');
    try{
      const response=await fetch(`/api/transactions/${editing.id}`,{
        method:'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({date,category_name:category,amount:numeric,note,account_name:account,kind,scope}),
      });
      const result=await response.json();
      if(!response.ok){
        setModalMsg(result.error||'Impossibile salvare.');
        return;
      }
      closeModal();
      refresh();
    }catch{
      setModalMsg('Errore di connessione.');
    }finally{
      setBusy(false);
    }
  }

  async function remove(){
    if(!editing)return;
    setBusy(true);
    setModalMsg('');
    try{
      const response=await fetch(`/api/transactions/${editing.id}?scope=${scope}`,{method:'DELETE'});
      const result=await response.json();
      if(!response.ok){
        setModalMsg(result.error||'Impossibile eliminare.');
        return;
      }
      closeModal();
      refresh();
    }catch{
      setModalMsg('Errore di connessione.');
    }finally{
      setBusy(false);
    }
  }

  return <>
    <header className="page-head"><div><h1>{t('movements.title')}</h1><p>{loading?t('movements.updating'):count===1?t('movements.one'):t('movements.many',{count})}</p></div></header>
    <div className="search-box surface"><Icon name="search" size={19}/><input value={q} onChange={event=>setQ(event.target.value)} placeholder={t('movements.search')} aria-label={t('movements.search')}/>{q&&<button type="button" className="search-clear" aria-label={t('movements.clearFilters')} onClick={()=>{setQ('');setDebouncedQ('');setPage(1)}}>×</button>}</div>
    <div className="live-filter-bar">
      <DateRangePicker start={periodStart} end={periodEnd} onChange={changeRange}/>
      <MovementFilterDropdown label={t('movements.category')} value={categoryFilter} options={categoryOptions} onChange={value=>{setCategoryFilter(value);setPage(1)}}/>
      <MovementFilterDropdown label={t('movements.type')} value={kindFilter} options={kindOptions} onChange={value=>{setKindFilter(value);setPage(1)}}/>
      {hasFilters&&<button type="button" className="clear-filters" onClick={clearFilters}>{t('movements.clearFilters')}</button>}
    </div>
    {members.length>1&&<div className="author-filter" aria-label={t('movements.by')}><span>{t('movements.by')}</span><div><button type="button" className={!author?'active':''} aria-pressed={!author} onClick={()=>{setAuthor('');setPage(1)}}>{t('movements.all')}</button>{members.map(member=><button type="button" key={member.userId} className={author===member.userId?'active':''} aria-pressed={author===member.userId} onClick={()=>{setAuthor(member.userId);setPage(1)}}>{member.name}</button>)}</div></div>}
    {error&&<div className="auth-error" role="alert">{error}</div>}
    {!loading&&!error&&!rows.length&&<div className="empty-state surface"><b>{t('movements.empty')}</b><p>{t('movements.emptyHelp')}</p></div>}
    {Object.entries(groups).map(([day,list])=>{const dayTotal=list.reduce((sum,row)=>sum+Number(row.amount),0);return <section className="day day-ledger" key={day}><div className="day-heading"><div className="day-date"><small>{t('movements.day')}</small><h3>{formatDate(day,{weekday:'long',day:'numeric',month:'short',year:'numeric'})}</h3></div><div className="day-total"><small>{t('movements.dayTotal')}</small><strong className={dayTotal>0?'green':dayTotal<0?'red':'muted'}>{dayTotal>0?'+ ':''}{currency(dayTotal)}</strong></div></div><div className="tx-card day-transactions surface">{list.map(row=>{
      const rowCategory=categoryData(row.category_name);
      return <button type="button" className="transaction transaction-button" key={row.id} onClick={()=>open(row)}><CategoryIcon name={row.category_name} icon={rowCategory?.icon} color={rowCategory?.color}/><span><b>{row.note||row.category_name}</b><small>{row.category_name}{row.author_name?` · ${row.author_name}`:''}</small></span><strong className={Number(row.amount)>=0?'green':'red'}>{Number(row.amount)>=0?'+ ':''}{currency(Number(row.amount))}</strong></button>;
    })}</div></section>})}
    {rows.length<count&&<div className="pager progressive-pager"><button disabled={loading} onClick={()=>setPage(value=>value+1)}>{loading?'Caricamento…':`Carica altri (${rows.length} di ${count})`}</button></div>}

    {editing&&<AdaptiveSheet open onClose={closeModal} title={modalView==='detail'?'Dettaglio movimento':modalView==='edit'?'Modifica movimento':'Elimina movimento'} size={modalView==='detail'?'medium':'large'} busy={busy} showHeader={false} className="transaction-modal-card"><div className="transaction-sheet-body">
      {modalView==='detail'&&<>
        <header className="transaction-modal-head">
          <div><span className="transaction-eyebrow">Dettaglio movimento</span><h2 id="transaction-modal-title">{editing.note||editing.category_name}</h2></div>
          <button type="button" className="transaction-close" aria-label="Chiudi dettaglio" onClick={closeModal}>×</button>
        </header>

        <section className="transaction-hero">
          <CategoryIcon name={editing.category_name} icon={activeCategory?.icon} color={activeCategory?.color} size={58}/>
          <div className="transaction-hero-copy"><strong className={Number(editing.amount)>=0?'green':'red'}>{Number(editing.amount)>=0?'+ ':''}{currency(Number(editing.amount))}</strong><span>{editing.category_name}</span></div>
          <span className={`transaction-kind ${Number(editing.amount)>=0?'income':'expense'}`}>{Number(editing.amount)>=0?'Entrata':'Uscita'}</span>
        </section>

        <dl className="transaction-facts">
          <div><dt>Data</dt><dd>{formatDate(editing.date,{day:'numeric',month:'long',year:'numeric'})}</dd></div>
          <div><dt>Conto</dt><dd>{editing.account_name||'Spese'}</dd></div>
          <div><dt>Inserito da</dt><dd>{editing.author_name||'—'}</dd></div>
          {recurring&&<div><dt>Ricorrenza</dt><dd><span className="recurring-badge">Movimento ricorrente</span></dd></div>}
        </dl>

        {recurring&&<div className="transaction-scope"><b>Applica l’azione a</b><div className="scope-choice"><label><input type="radio" name="detail-scope" checked={scope==='occurrence'} onChange={()=>setScope('occurrence')}/> Solo questa occorrenza</label><label><input type="radio" name="detail-scope" checked={scope==='series'} onChange={()=>setScope('series')}/> Occorrenza e serie futura</label></div></div>}

        <div className="transaction-actions"><button type="button" className="transaction-edit" onClick={()=>{setModalView('edit');setModalMsg('')}}>Modifica movimento</button><button type="button" className="transaction-delete-link" onClick={()=>{setModalView('delete');setModalMsg('')}}>Elimina movimento</button></div>
      </>}

      {modalView==='edit'&&<>
        <header className="transaction-modal-head">
          <div><span className="transaction-eyebrow">{editing.note||editing.category_name}</span><h2 id="transaction-modal-title">Modifica movimento</h2></div>
          <button type="button" className="transaction-close" aria-label="Annulla modifica" disabled={busy} onClick={()=>setModalView('detail')}>×</button>
        </header>
        <div className="segmented"><button type="button" className={kind==='expense'?'active':''} onClick={()=>changeEditKind('expense')}>Uscita</button><button type="button" className={kind==='income'?'active':''} onClick={()=>changeEditKind('income')}>Entrata</button></div>
        <div className="two-col"><div className="field"><label htmlFor="edit-transaction-amount">Importo</label><AmountExpressionInput id="edit-transaction-amount" value={amount} onChange={setAmount} ariaLabel="Importo del movimento"/></div><div className="field"><label>Data</label><input type="date" value={date} onChange={event=>setDate(event.target.value)}/></div></div>
        <div className="field"><label>Descrizione</label><input value={note} onChange={event=>setNote(event.target.value)}/></div>
        <div className="field"><label>Categoria {kind==='income'?'di entrata':'di spesa'}</label><div className="transaction-category-field"><CategoryIcon name={category||editing.category_name} icon={categoryData(category)?.icon} color={categoryData(category)?.color} size={44}/><select value={category} onChange={event=>setCategory(event.target.value)}>{editCategories.map(item=><option key={item.name}>{item.name}</option>)}</select></div></div>
        <div className="field"><label>Conto</label><input value={account} readOnly aria-readonly="true" title="Modificabile da Impostazioni > Conto per lo spazio visualizzato"/></div>
        {recurring&&<div className="transaction-scope"><b>Applica la modifica a</b><div className="scope-choice"><label><input type="radio" name="edit-scope" checked={scope==='occurrence'} onChange={()=>setScope('occurrence')}/> Solo questa occorrenza</label><label><input type="radio" name="edit-scope" checked={scope==='series'} onChange={()=>setScope('series')}/> Occorrenza e serie futura</label></div></div>}
        {modalMsg&&<div className="notice" role="status">{modalMsg}</div>}
        <div className="transaction-edit-actions"><button className="save-btn" disabled={busy} onClick={save}>{busy?'Salvataggio…':'Salva modifiche'}</button><button className="secondary" disabled={busy} onClick={()=>{setModalView('detail');setModalMsg('')}}>Annulla</button></div>
      </>}

      {modalView==='delete'&&<section className="transaction-confirm" aria-labelledby="transaction-modal-title">
        <span className="transaction-confirm-icon" aria-hidden="true">!</span>
        <h2 id="transaction-modal-title">Eliminare il movimento?</h2>
        <p>{recurring&&scope==='series'?'Questa occorrenza verrà eliminata e la serie futura sarà interrotta. I movimenti precedenti resteranno invariati.':'Il movimento verrà eliminato definitivamente. L’operazione non può essere annullata.'}</p>
        <div className="transaction-confirm-summary"><span>{editing.note||editing.category_name}</span><strong className={Number(editing.amount)>=0?'green':'red'}>{Number(editing.amount)>=0?'+ ':''}{currency(Number(editing.amount))}</strong></div>
        {modalMsg&&<div className="notice" role="status">{modalMsg}</div>}
        <div className="transaction-confirm-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>{setModalView('detail');setModalMsg('')}}>Annulla</button><button type="button" className="delete-btn" disabled={busy} onClick={remove}>{busy?'Eliminazione…':'Elimina definitivamente'}</button></div>
      </section>}
    </div></AdaptiveSheet>}
  </>;
}
