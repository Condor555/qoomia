'use client';

import {useEffect,useRef,useState} from 'react';
import AmountExpressionInput from './AmountExpressionInput';
import CategoryIcon from './CategoryIcon';
import SpacePicker,{type SpacePickerOption} from './SpacePicker';
import {amountForSave} from '../lib/amount-expression';
import {useI18n} from './LanguageProvider';

type Category={name:string;kind:'expense'|'income';icon?:string|null;color?:string|null};
type Space=SpacePickerOption;
type Kind='expense'|'income';
type Suggestion={note:string;category:string|null;categoryConfidence:number;frequency:number;lastUsed:string|null};
type NewTransactionComposerProps={embedded?:boolean;onSaved?:()=>void;onDirtyChange?:(dirty:boolean)=>void};

export default function NewTransactionComposer({embedded=false,onSaved,onDirtyChange}:NewTransactionComposerProps){
  const {currency,t}=useI18n();
  const [amount,setAmount]=useState('');
  const [note,setNote]=useState('');
  const [category,setCategory]=useState('');
  const [categories,setCategories]=useState<Category[]>([]);
  const [spaces,setSpaces]=useState<Space[]>([]);
  const [spaceId,setSpaceId]=useState('');
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [kind,setKind]=useState<Kind>('expense');
  const [account,setAccount]=useState('Spese');
  const [recurring,setRecurring]=useState(false);
  const [frequency,setFrequency]=useState('monthly');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [loadingSpace,setLoadingSpace]=useState(true);
  const [suggestions,setSuggestions]=useState<Suggestion[]>([]);
  const [suggestionsOpen,setSuggestionsOpen]=useState(false);
  const [suggestionsBusy,setSuggestionsBusy]=useState(false);
  const [activeSuggestion,setActiveSuggestion]=useState(0);
  const destinationRequestRef=useRef(0);
  const suggestionRequestRef=useRef(0);
  const suppressAutocompleteRef=useRef(false);
  const suggestionRefs=useRef<Array<HTMLButtonElement|null>>([]);

  useEffect(()=>{
    fetch('/api/spaces',{cache:'no-store'})
      .then(async response=>({ok:response.ok,result:await response.json()}))
      .then(({ok,result})=>{
        if(!ok){setMessage(result.error||'Impossibile caricare gli spazi.');return;}
        const list:Space[]=result.data||[];
        const selected=result.activeSpaceId||list.find(item=>item.type==='personal')?.id||list[0]?.id||'';
        setSpaces(list);
        setSpaceId(selected);
        if(selected)void loadDestination(selected);
        else setLoadingSpace(false);
      })
      .catch(()=>{setMessage('Errore di connessione.');setLoadingSpace(false);});
  },[]);

  useEffect(()=>{onDirtyChange?.(Boolean(amount.trim()||note.trim()||category||recurring))},[amount,note,category,recurring,onDirtyChange]);

  async function loadDestination(targetSpaceId:string){
    const request=++destinationRequestRef.current;
    suggestionRequestRef.current++;
    setLoadingSpace(true);
    setCategory('');
    setCategories([]);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setMessage('');
    try{
      const [categoryResponse,accountResponse]=await Promise.all([
        fetch(`/api/categories?spaceId=${encodeURIComponent(targetSpaceId)}`,{cache:'no-store'}),
        fetch(`/api/settings/account?spaceId=${encodeURIComponent(targetSpaceId)}`,{cache:'no-store'}),
      ]);
      const [categoryResult,accountResult]=await Promise.all([categoryResponse.json(),accountResponse.json()]);
      if(request!==destinationRequestRef.current)return;
      if(!categoryResponse.ok||!accountResponse.ok){
        setMessage(categoryResult.error||accountResult.error||'Impossibile caricare lo spazio.');
        return;
      }
      setCategories(Array.isArray(categoryResult.data)?categoryResult.data:[]);
      setAccount(accountResult.data?.name||'Spese');
    }catch{
      if(request===destinationRequestRef.current)setMessage('Errore di connessione.');
    }finally{
      if(request===destinationRequestRef.current)setLoadingSpace(false);
    }
  }

  function chooseSpace(nextSpaceId:string){
    setSpaceId(nextSpaceId);
    void loadDestination(nextSpaceId);
  }

  useEffect(()=>{
    const clean=note.trim();
    if(suppressAutocompleteRef.current){
      suppressAutocompleteRef.current=false;
      return;
    }
    if(clean.length<3||!spaceId||loadingSpace){
      suggestionRequestRef.current++;
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestionsBusy(false);
      return;
    }
    const request=++suggestionRequestRef.current;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setSuggestionsBusy(true);
      try{
        const suggestionPromise=fetch(`/api/transactions/suggestions?spaceId=${encodeURIComponent(spaceId)}&kind=${kind}&q=${encodeURIComponent(clean)}`,{cache:'no-store',signal:controller.signal}).then(async response=>({ok:response.ok,result:await response.json()}));
        const classifyPromise=clean.length>=3
          ?fetch('/api/classify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({note:clean,spaceId,kind}),signal:controller.signal}).then(async response=>({ok:response.ok,result:await response.json()}))
          :Promise.resolve({ok:false,result:{}});
        const [suggestionResult,classifyResult]=await Promise.all([suggestionPromise,classifyPromise]);
        if(request!==suggestionRequestRef.current)return;
        const nextSuggestions=suggestionResult.ok&&Array.isArray(suggestionResult.result.data)?suggestionResult.result.data:[];
        setSuggestions(nextSuggestions);
        setActiveSuggestion(0);
        setSuggestionsOpen(nextSuggestions.length>0);
        if(classifyResult.ok&&typeof classifyResult.result.category==='string'&&categories.some(item=>item.name===classifyResult.result.category&&item.kind===kind))setCategory(classifyResult.result.category);
      }catch(error:any){
        if(error?.name!=='AbortError'&&request===suggestionRequestRef.current){setSuggestions([]);setSuggestionsOpen(false);}
      }finally{
        if(request===suggestionRequestRef.current)setSuggestionsBusy(false);
      }
    },320);
    return()=>{clearTimeout(timer);controller.abort();};
  },[note,spaceId,loadingSpace,categories,kind]);

  function changeNote(value:string){
    setNote(value);
    if(value.trim().length<3){setSuggestions([]);setSuggestionsOpen(false);}
  }

  function selectSuggestion(suggestion:Suggestion){
    suppressAutocompleteRef.current=true;
    suggestionRequestRef.current++;
    setNote(suggestion.note);
    if(suggestion.category&&categories.some(item=>item.name===suggestion.category&&item.kind===kind))setCategory(suggestion.category);
    setSuggestions([]);
    setSuggestionsOpen(false);
  }

  function noteKeys(event:React.KeyboardEvent<HTMLInputElement>){
    if(event.key==='ArrowDown'&&suggestionsOpen&&suggestions.length){
      event.preventDefault();setActiveSuggestion(0);requestAnimationFrame(()=>suggestionRefs.current[0]?.focus());
    }else if(event.key==='Escape')setSuggestionsOpen(false);
  }

  function suggestionKeys(event:React.KeyboardEvent<HTMLButtonElement>,index:number){
    if(event.key==='ArrowDown'){
      event.preventDefault();const next=(index+1)%suggestions.length;setActiveSuggestion(next);suggestionRefs.current[next]?.focus();
    }else if(event.key==='ArrowUp'){
      event.preventDefault();const next=(index-1+suggestions.length)%suggestions.length;setActiveSuggestion(next);suggestionRefs.current[next]?.focus();
    }else if(event.key==='Home'){
      event.preventDefault();setActiveSuggestion(0);suggestionRefs.current[0]?.focus();
    }else if(event.key==='End'){
      event.preventDefault();const next=suggestions.length-1;setActiveSuggestion(next);suggestionRefs.current[next]?.focus();
    }else if(event.key==='Escape'){
      event.preventDefault();setSuggestionsOpen(false);document.getElementById('transaction-note')?.focus();
    }
  }

  function nextDate(value:string,selectedFrequency:string){
    const next=new Date(`${value}T12:00:00`);
    if(selectedFrequency==='weekly')next.setDate(next.getDate()+7);
    else if(selectedFrequency==='yearly')next.setFullYear(next.getFullYear()+1);
    else next.setMonth(next.getMonth()+1);
    return next.toISOString().slice(0,10);
  }

  async function save(){
    const numeric=amountForSave(amount);
    if(!spaceId){setMessage('Seleziona lo spazio di destinazione.');return;}
    if(numeric===null){setMessage('Inserisci un importo o un calcolo valido maggiore di zero.');return;}
    if(!category||!categories.some(item=>item.name===category&&item.kind===kind)){setMessage(`Seleziona una categoria di ${kind==='income'?'entrata':'spesa'} valida.`);return;}
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/transactions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({space_id:spaceId,date,category_name:category,amount:Math.abs(numeric),currency:'EUR',note,account_name:account,kind})});
      const result=await response.json();
      if(!response.ok){setMessage(result.error||'Errore nel salvataggio.');return;}
      if(recurring){
        const recurringResponse=await fetch('/api/recurring',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({space_id:spaceId,note,category_name:category,amount:kind==='expense'?-Math.abs(numeric):Math.abs(numeric),account_name:account,frequency,interval_count:1,next_run:nextDate(date,frequency)})});
        if(!recurringResponse.ok){
          const recurringResult=await recurringResponse.json();
          setMessage(`Movimento salvato, ma ricorrenza non creata: ${recurringResult.error||'errore sconosciuto'}`);return;
        }
      }
      setMessage(t('new.saved'));
      setAmount('');setNote('');setCategory('');setSuggestions([]);setSuggestionsOpen(false);setRecurring(false);
      onSaved?.();
    }catch{setMessage('Errore di connessione.');}
    finally{setBusy(false);}
  }

  const selectedCategory=categories.find(item=>item.name===category);
  const visibleCategories=categories.filter(item=>item.kind===kind);
  const amountPreview=amountForSave(amount);
  function chooseKind(next:Kind){if(next===kind)return;setKind(next);setCategory('');setSuggestions([]);setSuggestionsOpen(false);suggestionRequestRef.current++;}

  return <>
    {!embedded&&<header className="page-head"><div><h1>{t('new.title')}</h1><p>{t('new.subtitle')}</p></div></header>}
    <section className={`entry-card surface${embedded?' entry-card-embedded':''}`}>
      <SpacePicker spaces={spaces} value={spaceId} onChange={chooseSpace} variant="destination" label={t('space.destination')} help={t('new.destinationHelp')} disabled={busy||loadingSpace}/>
      <div className="segmented"><button type="button" className={kind==='expense'?'active':''} onClick={()=>chooseKind('expense')}>{t('common.expense')}</button><button type="button" className={kind==='income'?'active':''} onClick={()=>chooseKind('income')}>{t('common.income')}</button></div>
      <AmountExpressionInput className="amount-input-wrap" value={amount} onChange={setAmount} ariaLabel={t('new.amount')}/>
      <div className="field autocomplete-field"><label htmlFor="transaction-note">{t('common.description')}</label><input id="transaction-note" value={note} autoComplete="off" aria-autocomplete="list" aria-expanded={suggestionsOpen} aria-controls={suggestionsOpen?'transaction-note-suggestions':undefined} onFocus={()=>{if(suggestions.length)setSuggestionsOpen(true)}} onKeyDown={noteKeys} onChange={event=>changeNote(event.target.value)} placeholder={t('new.example')}/>{suggestionsBusy&&<span className="autocomplete-busy" aria-live="polite">{t('new.searching')}</span>}{suggestionsOpen&&suggestions.length>0&&<div id="transaction-note-suggestions" className="autocomplete-list" role="listbox" aria-label={t('common.description')}>{suggestions.map((suggestion,index)=><button ref={node=>{suggestionRefs.current[index]=node}} key={suggestion.note.toLocaleLowerCase()} type="button" role="option" aria-selected={index===activeSuggestion} tabIndex={index===activeSuggestion?0:-1} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActiveSuggestion(index)} onKeyDown={event=>suggestionKeys(event,index)} onClick={()=>selectSuggestion(suggestion)}><span><b>{suggestion.note}</b><small>{suggestion.category||t('new.categoryUnavailable')} · {suggestion.frequency===1?t('new.usedOnce'):t('new.usedMany',{count:suggestion.frequency})}</small></span><strong>↵</strong></button>)}</div>}</div>
      <div className="field"><label>{kind==='income'?t('new.incomeCategory'):t('new.expenseCategory')}</label><div className="category-picker"><CategoryIcon name={category||t('common.category')} icon={selectedCategory?.icon} color={selectedCategory?.color}/><select value={category} disabled={loadingSpace} onChange={event=>setCategory(event.target.value)}><option value="">{loadingSpace?t('new.loadingCategories'):visibleCategories.length?t('new.selectCategory'):t('new.noCategories')}</option>{visibleCategories.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select></div></div>
      <div className="two-col"><div className="field"><label>{t('common.date')}</label><input type="date" value={date} onChange={event=>setDate(event.target.value)}/></div><div className="field"><label>{t('new.account')}</label><input value={account} readOnly aria-readonly="true"/></div></div>
      <label className="toggle-card"><span><b>{t('new.recurring')}</b><small>{t('new.sameSpace')}</small></span><input type="checkbox" checked={recurring} onChange={event=>setRecurring(event.target.checked)}/></label>
      {recurring&&<select value={frequency} onChange={event=>setFrequency(event.target.value)}><option value="weekly">{t('new.weekly')}</option><option value="monthly">{t('new.monthly')}</option><option value="yearly">{t('new.yearly')}</option></select>}
      <button className="save-btn" disabled={busy||loadingSpace||!spaceId} onClick={save}>{busy?t('common.saving'):`${t('common.save')}${amountPreview!==null?` ${currency(amountPreview)}`:''}`}</button>
      {message&&<div className="notice" role="status">{message}</div>}
    </section>
  </>;
}
