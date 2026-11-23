'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import AmountExpressionInput from '../../components/AmountExpressionInput';
import AdaptiveSheet from '../../components/AdaptiveSheet';
import CategoryPickerSheet from '../../components/CategoryPickerSheet';
import ConfirmDialog from '../../components/ConfirmDialog';
import DateInput from '../../components/DateInput';
import Icon from '../../components/Icon';
import CategoryIcon from '../../components/CategoryIcon';
import DateRangePicker,{type DateRange} from '../../components/DateRangePicker';
import MovementFilterDropdown from '../../components/MovementFilterDropdown';
import {onActiveSpaceChanged} from '../../lib/active-space-client';
import {amountForSave} from '../../lib/amount-expression';
import {useI18n} from '../../components/LanguageProvider';
import {AsyncButton,EmptyState,InlineError,SkeletonRows} from '../../components/UXFeedback';
import {useToast} from '../../components/ToastProvider';

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
  const {showToast}=useToast();
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
  const [categoryPickerOpen,setCategoryPickerOpen]=useState(false);
  const [discardEditOpen,setDiscardEditOpen]=useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [urlReady,setUrlReady]=useState(false);
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
    const params=new URLSearchParams(window.location.search);
    const nextQuery=params.get('q')||'';
    setQ(nextQuery);setDebouncedQ(nextQuery.trim());
    setPeriodStart(params.get('start')||'');setPeriodEnd(params.get('end')||'');
    setCategoryFilter(params.get('category')||'');setKindFilter(params.get('kind')||'');setAuthor(params.get('author')||'');
    setUrlReady(true);
  },[]);

  useEffect(()=>{
    if(!urlReady)return;
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
  },[urlReady,debouncedQ,periodStart,periodEnd,author,categoryFilter,kindFilter,page,spaceId,reloadToken]);

  useEffect(()=>{loadMetadata()},[]);
  useEffect(()=>onActiveSpaceChanged(id=>{
    listRequestRef.current++;listAbortRef.current?.abort();metadataRequestRef.current++;
    setSpaceId(id);setRows([]);setCount(0);setPage(1);setAuthor('');setEditing(null);void loadMetadata(id);
  }),[]);

  function changeRange(range:DateRange){setPeriodStart(range.start);setPeriodEnd(range.end);setPage(1)}
  const activeFilterCount=[Boolean(periodStart||periodEnd),Boolean(author),Boolean(categoryFilter),Boolean(kindFilter)].filter(Boolean).length;
  function refresh(){setPage(1);setReloadToken(value=>value+1)}
  function changeSearch(value:string){
    setQ(value);
    if(!value.trim()){
      setDebouncedQ('');
      setPage(1);
      setError('');
    }
  }
  function resetFilters(){setPeriodStart('');setPeriodEnd('');setAuthor('');setCategoryFilter('');setKindFilter('');setPage(1);setError('')}

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
      showToast({message:'Movimento aggiornato.',tone:'success'});
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
      showToast({message:'Movimento eliminato.',tone:'success'});
      refresh();
    }catch{
      setModalMsg('Errore di connessione.');
    }finally{
      setBusy(false);
    }
  }

  const editDirty=Boolean(editing&&modalView==='edit'&&(
    date!==editing.date||category!==editing.category_name||
    amount!==String(Math.abs(Number(editing.amount))).replace('.',',')||
    note!==(editing.note||'')||account!==(editing.account_name||'Spese')||
    kind!==(Number(editing.amount)<0?'expense':'income')
  ));
  function cancelEdit(){if(editDirty)setDiscardEditOpen(true);else setModalView('detail')}
  function discardEdit(){
    if(editing){setDate(editing.date);setCategory(editing.category_name);setAmount(String(Math.abs(Number(editing.amount))).replace('.',','));setNote(editing.note||'');setAccount(editing.account_name||'Spese');setKind(Number(editing.amount)<0?'expense':'income')}
    setDiscardEditOpen(false);setModalMsg('');setModalView('detail');
  }

  return <>
    <header className="page-head"><div><h1>{t('movements.title')}</h1><p>{loading?t('movements.updating'):count===1?t('movements.one'):t('movements.many',{count})}</p></div></header>
    <div className="movement-search-toolbar"><div className="search-box surface"><Icon name="search" size={19}/><input value={q} onChange={event=>changeSearch(event.target.value)} placeholder={t('movements.search')} aria-label={t('movements.search')}/>{q&&<button type="button" className="search-clear" aria-label="Cancella ricerca" onClick={()=>changeSearch('')}>×</button>}</div><button type="button" className={`movement-filter-button${activeFilterCount?' active':''}`} aria-label={activeFilterCount?`Filtri, ${activeFilterCount} attivi`:'Apri filtri'} aria-haspopup="dialog" onClick={()=>setFiltersOpen(true)}><Icon name="more" size={22}/>{activeFilterCount>0&&<span aria-hidden="true">{activeFilterCount}</span>}</button></div>
    {activeFilterCount>0&&<div className="movement-active-filters" aria-label="Filtri attivi">{(periodStart||periodEnd)&&<button type="button" onClick={()=>changeRange({start:'',end:''})}><span>Periodo</span><b aria-hidden="true">×</b></button>}{categoryFilter&&<button type="button" onClick={()=>{setCategoryFilter('');setPage(1)}}><span>{categoryFilter}</span><b aria-hidden="true">×</b></button>}{kindFilter&&<button type="button" onClick={()=>{setKindFilter('');setPage(1)}}><span>{kindFilter==='expense'?'Uscite':'Entrate'}</span><b aria-hidden="true">×</b></button>}{author&&<button type="button" onClick={()=>{setAuthor('');setPage(1)}}><span>{members.find(member=>member.userId===author)?.name||'Autore'}</span><b aria-hidden="true">×</b></button>}<button type="button" className="movement-reset-shortcut" onClick={resetFilters}>Azzera</button></div>}
    {error&&<InlineError message={error} onRetry={refresh}/>}
    {loading&&page===1&&!rows.length&&<div className="movement-loading surface"><SkeletonRows rows={5}/></div>}
    {!loading&&!error&&!rows.length&&<EmptyState title={t('movements.empty')} description={t('movements.emptyHelp')} icon="list"/>}
    <div className={loading&&rows.length?'movement-results is-updating':'movement-results'} aria-busy={loading}>{Object.entries(groups).map(([day,list])=>{const dayTotal=list.reduce((sum,row)=>sum+Number(row.amount),0);return <section className="day day-ledger" key={day}><div className="day-heading"><div className="day-date"><small>{t('movements.day')}</small><h3>{formatDate(day,{weekday:'long',day:'numeric',month:'short',year:'numeric'})}</h3></div><div className="day-total"><small>{t('movements.dayTotal')}</small><strong className={dayTotal>0?'green':dayTotal<0?'red':'muted'}>{dayTotal>0?'+ ':''}{currency(dayTotal)}</strong></div></div><div className="tx-card day-transactions surface">{list.map(row=>{
      const rowCategory=categoryData(row.category_name);
      return <button type="button" className="transaction transaction-button" key={row.id} onClick={()=>open(row)}><CategoryIcon name={row.category_name} icon={rowCategory?.icon} color={rowCategory?.color}/><span><b>{row.note||row.category_name}</b><small>{row.category_name}{row.author_name?` · ${row.author_name}`:''}</small></span><strong className={Number(row.amount)>=0?'green':'red'}>{Number(row.amount)>=0?'+ ':''}{currency(Number(row.amount))}</strong></button>;
    })}</div></section>})}</div>
    {rows.length<count&&<div className="pager progressive-pager"><AsyncButton variant="secondary" busy={loading} busyLabel="Caricamento…" onClick={()=>setPage(value=>value+1)}>Carica altri ({rows.length} di {count})</AsyncButton></div>}

    {editing&&<AdaptiveSheet open onClose={closeModal} title={modalView==='detail'?(editing.note||editing.category_name):modalView==='edit'?'Modifica movimento':'Elimina movimento'} eyebrow={modalView==='detail'?'Dettaglio movimento':modalView==='edit'?(editing.note||editing.category_name):'Conferma'} size={modalView==='detail'?'medium':'large'} busy={busy} dirty={editDirty} className="transaction-modal-card"><div className="transaction-sheet-body">
      {modalView==='detail'&&<>
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
        <div className="segmented"><button type="button" className={kind==='expense'?'active':''} onClick={()=>changeEditKind('expense')}>Uscita</button><button type="button" className={kind==='income'?'active':''} onClick={()=>changeEditKind('income')}>Entrata</button></div>
        <div className="two-col transaction-meta-grid"><div className="field"><label htmlFor="edit-transaction-amount">Importo</label><AmountExpressionInput id="edit-transaction-amount" value={amount} onChange={setAmount} ariaLabel="Importo del movimento"/></div><div className="field"><label>Data</label><DateInput value={date} onChange={setDate} ariaLabel="Data del movimento"/></div></div>
        <div className="field"><label>Descrizione</label><input value={note} onChange={event=>setNote(event.target.value)}/></div>
        <div className="field"><label>Categoria {kind==='income'?'di entrata':'di spesa'}</label><button type="button" className="category-picker-trigger" onClick={()=>setCategoryPickerOpen(true)}><CategoryIcon name={category||editing.category_name} icon={categoryData(category)?.icon} color={categoryData(category)?.color} size={44}/><span><small>{kind==='income'?'Categoria di entrata':'Categoria di spesa'}</small><strong>{category||'Seleziona categoria'}</strong></span><b aria-hidden="true">›</b></button></div>
        <div className="field"><label>Conto</label><input value={account} readOnly aria-readonly="true" title="Modificabile da Impostazioni > Conto per lo spazio visualizzato"/></div>
        {recurring&&<div className="transaction-scope"><b>Applica la modifica a</b><div className="scope-choice"><label><input type="radio" name="edit-scope" checked={scope==='occurrence'} onChange={()=>setScope('occurrence')}/> Solo questa occorrenza</label><label><input type="radio" name="edit-scope" checked={scope==='series'} onChange={()=>setScope('series')}/> Occorrenza e serie futura</label></div></div>}
        {modalMsg&&<InlineError message={modalMsg}/>}
        <div className="transaction-edit-actions"><AsyncButton className="save-btn" busy={busy} busyLabel="Salvataggio…" onClick={save}>Salva modifiche</AsyncButton><button className="secondary" disabled={busy} onClick={cancelEdit}>Annulla</button></div>
      </>}

      {modalView==='delete'&&<section className="transaction-confirm" aria-labelledby="transaction-modal-title">
        <span className="transaction-confirm-icon" aria-hidden="true">!</span>
        <h2 id="transaction-modal-title">Eliminare il movimento?</h2>
        <p>{recurring&&scope==='series'?'Questa occorrenza verrà eliminata e la serie futura sarà interrotta. I movimenti precedenti resteranno invariati.':'Il movimento verrà eliminato definitivamente. L’operazione non può essere annullata.'}</p>
        <div className="transaction-confirm-summary"><span>{editing.note||editing.category_name}</span><strong className={Number(editing.amount)>=0?'green':'red'}>{Number(editing.amount)>=0?'+ ':''}{currency(Number(editing.amount))}</strong></div>
        {modalMsg&&<InlineError message={modalMsg}/>}
        <div className="transaction-confirm-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>{setModalView('detail');setModalMsg('')}}>Annulla</button><AsyncButton type="button" variant="danger" busy={busy} busyLabel="Eliminazione…" onClick={remove}>Elimina definitivamente</AsyncButton></div>
      </section>}
    </div></AdaptiveSheet>}
    <CategoryPickerSheet open={categoryPickerOpen} onClose={()=>setCategoryPickerOpen(false)} categories={categories} value={category} kind={kind} onKindChange={changeEditKind} onChange={setCategory} spaceId={spaceId}/>
    <ConfirmDialog open={discardEditOpen} title="Scartare le modifiche?" message="Le modifiche al movimento non sono state salvate." confirmLabel="Scarta" destructive onClose={()=>setDiscardEditOpen(false)} onConfirm={discardEdit}/>
    <AdaptiveSheet open={filtersOpen} onClose={()=>setFiltersOpen(false)} title="Filtri" eyebrow="Movimenti" size="medium" className="movement-filters-sheet"><div className="movement-filter-sheet-content">
      <section className="movement-filter-group"><h3>Periodo</h3><DateRangePicker start={periodStart} end={periodEnd} onChange={changeRange}/></section>
      <section className="movement-filter-group"><h3>Categoria</h3><MovementFilterDropdown label={t('movements.category')} value={categoryFilter} options={categoryOptions} onChange={value=>{setCategoryFilter(value);setPage(1)}}/></section>
      <section className="movement-filter-group"><h3>Tipo</h3><MovementFilterDropdown label={t('movements.type')} value={kindFilter} options={kindOptions} onChange={value=>{setKindFilter(value);setPage(1)}}/></section>
      {members.length>1&&<section className="movement-filter-group"><h3>{t('movements.by')}</h3><div className="filter-author-chips"><button type="button" className={!author?'active':''} aria-pressed={!author} onClick={()=>{setAuthor('');setPage(1)}}>{t('movements.all')}</button>{members.map(member=><button type="button" key={member.userId} className={author===member.userId?'active':''} aria-pressed={author===member.userId} onClick={()=>{setAuthor(member.userId);setPage(1)}}>{member.name}</button>)}</div></section>}
      <div className="movement-filter-status" role="status">{activeFilterCount?`${activeFilterCount} ${activeFilterCount===1?'filtro attivo':'filtri attivi'} · aggiornamento immediato`:'Nessun filtro attivo'}</div>
      <button type="button" className="clear-filters-sheet" disabled={!activeFilterCount} onClick={resetFilters}>Azzera filtri</button>
    </div></AdaptiveSheet>
  </>;
}
