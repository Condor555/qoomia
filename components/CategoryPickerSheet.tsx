'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import AdaptiveSheet from './AdaptiveSheet';
import CategoryIcon from './CategoryIcon';
import Icon from './Icon';
import {EmptyState,SkeletonRows} from './UXFeedback';
import {cachedJson} from '../lib/client-json-cache';

export type PickerCategory={name:string;kind:'expense'|'income';icon?:string|null;color?:string|null};
type Kind='expense'|'income';
type Usage={recent:string[];frequent:string[]};

type Props={
  open:boolean;
  onClose:()=>void;
  categories:PickerCategory[];
  value:string;
  kind:Kind;
  onKindChange:(kind:Kind)=>void;
  onChange:(name:string)=>void;
  spaceId:string;
  loading?:boolean;
};

export default function CategoryPickerSheet({open,onClose,categories,value,kind,onKindChange,onChange,spaceId,loading=false}:Props){
  const [query,setQuery]=useState('');
  const [usage,setUsage]=useState<Usage>({recent:[],frequent:[]});
  const [usageLoading,setUsageLoading]=useState(false);

  useEffect(()=>{
    if(!open){setQuery('');return;}
    if(!spaceId){setUsage({recent:[],frequent:[]});return;}
    let live=true;
    setUsageLoading(true);
    cachedJson<Usage>(`/api/categories/usage?spaceId=${encodeURIComponent(spaceId)}&kind=${kind}`)
      .then(result=>{if(live)setUsage({recent:result.recent||[],frequent:result.frequent||[]})})
      .catch(()=>{if(live)setUsage({recent:[],frequent:[]})})
      .finally(()=>{if(live)setUsageLoading(false)});
    return()=>{live=false};
  },[open,spaceId,kind]);

  const filtered=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase('it');
    return categories.filter(item=>item.kind===kind&&(!needle||item.name.toLocaleLowerCase('it').includes(needle))).sort((a,b)=>a.name.localeCompare(b.name,'it'));
  },[categories,kind,query]);
  const byName=useMemo(()=>new Map(categories.filter(item=>item.kind===kind).map(item=>[item.name,item])),[categories,kind]);
  const recent=usage.recent.map(name=>byName.get(name)).filter((item):item is PickerCategory=>Boolean(item)).slice(0,5);
  const frequent=usage.frequent.map(name=>byName.get(name)).filter((item):item is PickerCategory=>Boolean(item)).filter(item=>!recent.some(recentItem=>recentItem.name===item.name)).slice(0,6);

  function choose(name:string){onChange(name);onClose()}
  function renderGrid(items:PickerCategory[],section:string){
    return <div className="category-picker-grid">{items.map(item=><button type="button" key={`${section}-${item.name}`} className={item.name===value?'selected':''} aria-pressed={item.name===value} onClick={()=>choose(item.name)}><CategoryIcon name={item.name} icon={item.icon||undefined} color={item.color||undefined} size={42}/><span>{item.name}</span>{item.name===value&&<b aria-hidden="true">✓</b>}</button>)}</div>;
  }

  return <AdaptiveSheet open={open} onClose={onClose} title="Scegli categoria" eyebrow="Movimento" size="large" className="category-picker-sheet">
    <div className="category-picker-kind segmented" role="tablist" aria-label="Tipo di categoria"><button type="button" role="tab" aria-selected={kind==='expense'} className={kind==='expense'?'active':''} onClick={()=>onKindChange('expense')}>Uscite</button><button type="button" role="tab" aria-selected={kind==='income'} className={kind==='income'?'active':''} onClick={()=>onKindChange('income')}>Entrate</button></div>
    <label className="category-picker-search"><Icon name="search" size={19}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cerca categoria" aria-label="Cerca categoria" autoFocus/>{query&&<button type="button" aria-label="Cancella ricerca" onClick={()=>setQuery('')}>×</button>}</label>
    {loading||usageLoading&&!categories.length?<SkeletonRows rows={5}/>:query?filtered.length?<section className="category-picker-section"><h3>Risultati</h3>{renderGrid(filtered,'search')}</section>:<EmptyState title="Nessuna categoria trovata" description="Prova con un altro nome o gestisci le categorie." icon="search"/>:<>
      {recent.length>0&&<section className="category-picker-section"><h3>Recenti</h3>{renderGrid(recent,'recent')}</section>}
      {frequent.length>0&&<section className="category-picker-section"><h3>Più usate</h3>{renderGrid(frequent,'frequent')}</section>}
      <section className="category-picker-section"><h3>Tutte le categorie</h3>{filtered.length?renderGrid(filtered,'all'):<EmptyState title={kind==='income'?'Nessuna categoria di entrata':'Nessuna categoria di spesa'} description="Puoi crearla da Gestisci categorie."/>}</section>
    </>}
    <Link href="/account/categorie" className="category-manage-link"><Icon name="settings" size={18}/> Gestisci categorie</Link>
  </AdaptiveSheet>;
}
