'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import AmountExpressionInput from '../../components/AmountExpressionInput';
import Icon from '../../components/Icon';
import CategoryIcon from '../../components/CategoryIcon';
import DateRangePicker,{type DateRange} from '../../components/DateRangePicker';
import MovementFilterDropdown from '../../components/MovementFilterDropdown';
import {onActiveSpaceChanged} from '../../lib/active-space-client';
import {amountForSave} from '../../lib/amount-expression';
import {useI18n} from '../../components/LanguageProvider';
import {cachedJson,invalidateClientJson} from '../../lib/client-json-cache';

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
type ViewMode='list'|'calendar';

function localDateKey(value=new Date()){
  const year=value.getFullYear();
  const month=String(value.getMonth()+1).padStart(2,'0');
  const day=String(value.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
}

function currentMonthKey(){return localDateKey().slice(0,7)}

function monthBounds(month:string){
  const [year,monthNumber]=month.split('-').map(Number);
  const lastDay=new Date(year,monthNumber,0).getDate();
  return {start:`${month}-01`,end:`${month}-${String(lastDay).padStart(2,'0')}`};
}

function moveMonth(month:string,offset:number){
  const [year,monthNumber]=month.split('-').map(Number);
  const next=new Date(year,monthNumber-1+offset,1,12);
  return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;
}

function calendarCells(month:string){
  const [year,monthNumber]=month.split('-').map(Number);
  const first=new Date(year,monthNumber-1,1,12);
  const mondayOffset=(first.getDay()+6)%7;
  const daysInMonth=new Date(year,monthNumber,0).getDate();
  const cells=Math.ceil((mondayOffset+daysInMonth)/7)*7;
  return Array.from({length:cells},(_,index)=>{
    const value=new Date(year,monthNumber-1,index-mondayOffset+1,12);
    return {key:localDateKey(value),day:value.getDate(),inMonth:value.getMonth()===monthNumber-1};
  });
}

export default function Movimenti(){
  const {currency,date:formatDate,localeTag,t}=useI18n();
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
  const [viewMode,setViewMode]=useState<ViewMode>('list');
  const [calendarMonth,setCalendarMonth]=useState(currentMonthKey);
  const [selectedDay,setSelectedDay]=useState(localDateKey);

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
      const [categoryResult,memberResult]=await Promise.all([
        cachedJson<{data?:Category[]}>(`/api/categories${suffix}`,{onRevalidate:value=>{if(request===metadataRequestRef.current)setCategories(value.data||[])}}),
        cachedJson<{data?:Member[]}>(`/api/members${suffix}`,{onRevalidate:value=>{if(request===metadataRequestRef.current)setMembers(value.data||[])}}),
      ]);
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
    const calendarRange=monthBounds(calendarMonth);
    const params=new URLSearchParams({page:String(viewMode==='calendar'?1:page),size:viewMode==='calendar'?'250':'30'});
    if(debouncedQ)params.set('q',debouncedQ);
    if(viewMode==='calendar'){
      params.set('start',calendarRange.start);
      params.set('end',calendarRange.end);
    }else{
      if(periodStart)params.set('start',periodStart);
      if(periodEnd)params.set('end',periodEnd);
    }
    if(author)params.set('author',author);
    if(categoryFilter)params.set('category',categoryFilter);
    if(kindFilter)params.set('kind',kindFilter);
    if(spaceId)params.set('spaceId',spaceId);
    setLoading(true);setError('');
    const url=`/api/transactions?${params}`;
    cachedJson<{data?:Transaction[];count?:number}>(url,{signal:controller.signal,onRevalidate:result=>{if(request===listRequestRef.current){setRows(Array.isArray(result.data)?result.data:[]);setCount(Number(result.count||0))}}})
      .then(result=>{
        if(request!==listRequestRef.current)return;
        setRows(Array.isArray(result.data)?result.data:[]);setCount(Number(result.count||0));
      })
      .catch(error=>{if(error?.name!=='AbortError'&&request===listRequestRef.current){setRows([]);setCount(0);setError(error?.message||'Errore di connessione.')}})
      .finally(()=>{if(request===listRequestRef.current)setLoading(false)});
    return()=>controller.abort();
  },[debouncedQ,periodStart,periodEnd,author,categoryFilter,kindFilter,page,spaceId,reloadToken,viewMode,calendarMonth]);

  useEffect(()=>{loadMetadata()},[]);
  useEffect(()=>onActiveSpaceChanged(id=>{
    listRequestRef.current++;listAbortRef.current?.abort();metadataRequestRef.current++;
    setSpaceId(id);setRows([]);setCount(0);setPage(1);setAuthor('');setCategoryFilter('');setEditing(null);void loadMetadata(id);
  }),[]);

  function changeRange(range:DateRange){setPeriodStart(range.start);setPeriodEnd(range.end);setPage(1)}
  const hasFilters=Boolean(q||periodStart||periodEnd||author||categoryFilter||kindFilter);
  function clearFilters(){setQ('');setDebouncedQ('');setPeriodStart('');setPeriodEnd('');setAuthor('');setCategoryFilter('');setKindFilter('');setPage(1)}
  function refresh(){invalidateClientJson('/api/transactions','/api/stats','/api/budgets');setReloadToken(value=>value+1)}

  useEffect(()=>{
    if(!editing)return;
    function onKeyDown(event:KeyboardEvent){
      if(event.key==='Escape'&&!busy)closeModal();
    }
    window.addEventListener('keydown',onKeyDown);
    return()=>window.removeEventListener('keydown',onKeyDown);
  },[editing,busy]);

  const groups=useMemo(()=>rows.reduce<Record<string,Transaction[]>>((all,row)=>{
    (all[row.date]||=[]).push(row);
    return all;
  },{}),[rows]);
  const calendarDays=useMemo(()=>calendarCells(calendarMonth),[calendarMonth]);
  const weekdayLabels=useMemo(()=>Array.from({length:7},(_,index)=>new Intl.DateTimeFormat(localeTag,{weekday:'narrow'}).format(new Date(2026,10,2+index,12))),[localeTag]);
  const calendarTitle=useMemo(()=>new Intl.DateTimeFormat(localeTag,{month:'long',year:'numeric'}).format(new Date(`${calendarMonth}-01T12:00:00`)),[calendarMonth,localeTag]);
  const selectedRows=useMemo(()=>groups[selectedDay]||[],[groups,selectedDay]);
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

  function setMode(next:ViewMode){
    setViewMode(next);
    setPage(1);
    if(next==='calendar'){
      const nextMonth=periodStart?.slice(0,7)||currentMonthKey();
      setCalendarMonth(nextMonth);
      setSelectedDay(nextMonth===currentMonthKey()?localDateKey():`${nextMonth}-01`);
    }
  }

  function changeCalendarMonth(offset:number){
    const next=moveMonth(calendarMonth,offset);
    setCalendarMonth(next);
    setSelectedDay(next===currentMonthKey()?localDateKey():`${next}-01`);
    setPage(1);
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

  function transactionButton(row:Transaction){
    const rowCategory=categoryData(row.category_name);
    return <button type="button" className="transaction transaction-button" key={row.id} onClick={()=>open(row)}><CategoryIcon name={row.category_name} icon={rowCategory?.icon} color={rowCategory?.color}/><span><b>{row.note||row.category_name}</b><small>{row.category_name}{row.author_name?` · ${row.author_name}`:''}</small></span><strong className={Number(row.amount)>=0?'green':'red'}>{Number(row.amount)>=0?'+ ':''}{currency(Number(row.amount))}</strong></button>;
  }

  return <>
    <header className="page-head movements-head"><div><h1>{t('movements.title')}</h1><p>{loading?t('movements.updating'):count===1?t('movements.one'):t('movements.many',{count})}</p></div><div className="movement-view-toggle" role="group" aria-label={t('movements.title')}><button type="button" className={viewMode==='list'?'active':''} aria-pressed={viewMode==='list'} onClick={()=>setMode('list')}><Icon name="list" size={18}/><span>{t('movements.listView')}</span></button><button type="button" className={viewMode==='calendar'?'active':''} aria-pressed={viewMode==='calendar'} onClick={()=>setMode('calendar')}><Icon name="calendar" size={18}/><span>{t('movements.calendarView')}</span></button></div></header>
    <div className="search-box surface"><Icon name="search" size={19}/><input value={q} onChange={event=>setQ(event.target.value)} placeholder={t('movements.search')} aria-label={t('movements.search')}/>{q&&<button type="button" className="search-clear" aria-label={t('movements.clearFilters')} onClick={()=>{setQ('');setDebouncedQ('');setPage(1)}}>×</button>}</div>
    <div className="live-filter-bar">
      {viewMode==='list'&&<DateRangePicker start={periodStart} end={periodEnd} onChange={changeRange}/>}
      <MovementFilterDropdown label={t('movements.category')} value={categoryFilter} options={categoryOptions} onChange={value=>{setCategoryFilter(value);setPage(1)}}/>
      <MovementFilterDropdown label={t('movements.type')} value={kindFilter} options={kindOptions} onChange={value=>{setKindFilter(value);setPage(1)}}/>
      {hasFilters&&<button type="button" className="clear-filters" onClick={clearFilters}>{t('movements.clearFilters')}</button>}
    </div>
    {members.length>1&&<div className="author-filter" aria-label={t('movements.by')}><span>{t('movements.by')}</span><div><button type="button" className={!author?'active':''} aria-pressed={!author} onClick={()=>{setAuthor('');setPage(1)}}>{t('movements.all')}</button>{members.map(member=><button type="button" key={member.userId} className={author===member.userId?'active':''} aria-pressed={author===member.userId} onClick={()=>{setAuthor(member.userId);setPage(1)}}>{member.name}</button>)}</div></div>}
    {error&&<div className="auth-error" role="alert">{error}</div>}
    {viewMode==='list'&&<>
      {!loading&&!error&&!rows.length&&<div className="empty-state surface"><b>{t('movements.empty')}</b><p>{t('movements.emptyHelp')}</p></div>}
      {Object.entries(groups).map(([day,list])=>{const dayTotal=list.reduce((sum,row)=>sum+Number(row.amount),0);return <section className="day day-ledger" key={day}><div className="day-heading"><div className="day-date"><small>{t('movements.day')}</small><h3>{formatDate(day,{weekday:'long',day:'numeric',month:'short',year:'numeric'})}</h3></div><div className="day-total"><small>{t('movements.dayTotal')}</small><strong className={dayTotal>0?'green':dayTotal<0?'red':'muted'}>{dayTotal>0?'+ ':''}{currency(dayTotal)}</strong></div></div><div className="tx-card day-transactions surface">{list.map(transactionButton)}</div></section>})}
      <div className="pager"><button disabled={page===1||loading} onClick={()=>setPage(value=>Math.max(1,value-1))}>{t('movements.previous')}</button><span>{page}</span><button disabled={page*30>=count||loading} onClick={()=>setPage(value=>value+1)}>{t('movements.next')}</button></div>
    </>}

    {viewMode==='calendar'&&<section className="transaction-calendar surface" aria-label={t('movements.calendarView')}>
      <header className="calendar-toolbar"><button type="button" onClick={()=>changeCalendarMonth(-1)} aria-label={t('movements.previousMonth')}><Icon name="chevronLeft" size={21}/></button><div><h2>{calendarTitle}</h2><small>{t('movements.calendarHelp')}</small></div><button type="button" onClick={()=>changeCalendarMonth(1)} aria-label={t('movements.nextMonth')}><Icon name="chevronLeft" size={21}/></button></header>
      <div className="calendar-weekdays" aria-hidden="true">{weekdayLabels.map((label,index)=><span key={`${label}-${index}`}>{label}</span>)}</div>
      <div className="calendar-grid">{calendarDays.map(day=>{
        const dayRows=groups[day.key]||[];
        const total=dayRows.reduce((sum,row)=>sum+Number(row.amount),0);
        const active=selectedDay===day.key;
        return <button type="button" key={day.key} className={`${day.inMonth?'':'outside'}${active?' selected':''}${dayRows.length?' has-transactions':''}`} aria-pressed={active} aria-label={`${formatDate(day.key,{day:'numeric',month:'long'})}${dayRows.length?` · ${dayRows.length} · ${currency(total)}`:''}`} onClick={()=>{if(day.inMonth)setSelectedDay(day.key)}} disabled={!day.inMonth}><span className="calendar-day-number">{day.day}</span>{dayRows.length>0&&<><span className={`calendar-day-total ${total>=0?'green':'red'}`}>{currency(total)}</span><span className="calendar-day-dot" aria-hidden="true"/></>}</button>;
      })}</div>
      {count>250&&<p className="calendar-overflow" role="status">{t('movements.monthOverflow')}</p>}
      <div className="calendar-day-detail"><div className="day-heading"><div className="day-date"><small>{t('movements.day')}</small><h3>{formatDate(selectedDay,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h3></div>{selectedRows.length>0&&<div className="day-total"><small>{t('movements.dayTotal')}</small><strong className={selectedRows.reduce((sum,row)=>sum+Number(row.amount),0)>=0?'green':'red'}>{currency(selectedRows.reduce((sum,row)=>sum+Number(row.amount),0))}</strong></div>}</div>{selectedRows.length?<div className="calendar-day-transactions">{selectedRows.map(transactionButton)}</div>:<p className="calendar-day-empty">{t('movements.noDayTransactions')}</p>}</div>
    </section>}

    {editing&&<div className="modal transaction-modal" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)closeModal()}}><div className="modal-card transaction-modal-card surface" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title">
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
    </div></div>}
  </>;
}
