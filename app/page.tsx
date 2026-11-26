'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import Icon from '../components/Icon';
import CategoryIcon from '../components/CategoryIcon';
import MonthPicker from '../components/MonthPicker';
import {onActiveSpaceChanged} from '../lib/active-space-client';
import {useSharedMonth} from '../lib/selected-period-client';
import {useI18n} from '../components/LanguageProvider';
import QoomiaLogo from '../components/QoomiaLogo';
import MonthlyInsightCard from '../components/MonthlyInsightCard';
import {InlineError,Skeleton,SkeletonRows} from '../components/UXFeedback';
import {cachedJson} from '../lib/client-json-cache';

type TopCategory={name:string;value:number;percentage:number;previousValue:number;changePercent:number|null;comparison:'available'|'no-previous-data';icon?:string|null;color?:string|null};
type Stats={
  periodStatus:'past'|'current'|'future';
  income:number;
  expense:number;
  balance:number;
  count:number;
  previousExpense:number;
  expenseChangePercent:number|null;
  projectedExpense:number|null;
  dailyAverageExpense:number;
  daysConsidered:number;
  daysInMonth:number;
  smartFinance:{projectedBalance:number;currentBalance:number;scheduledIncome:number;scheduledExpense:number;historicalIncome:number;projectedVariableExpense:number;confidence:'high'|'medium'|'low'}|null;
  topCategory:TopCategory|null;
  budget:{amount:number;spent:number;available:number;percentage:number;status:'ok'|'warning'|'over';projected:number;projectedOverage:number;commitments:number;distributable:number};
};
type RecentTransaction={id:string;date:string;category_name:string;amount:number;note:string;author_name?:string};
type RecentCategory={name:string;icon?:string|null;color?:string|null};

export default function Home(){
  const {currency,locale,localeTag,t}=useI18n();
  const {month,setMonth}=useSharedMonth();
  const [stats,setStats]=useState<Stats|null>(null);
  const [recent,setRecent]=useState<RecentTransaction[]>([]);
  const [recentCategories,setRecentCategories]=useState<RecentCategory[]>([]);
  const [recentLoading,setRecentLoading]=useState(true);
  const [recentError,setRecentError]=useState('');
  const statsRequestRef=useRef(0);
  const statsAbortRef=useRef<AbortController|null>(null);
  const recentRequestRef=useRef(0);
  const recentAbortRef=useRef<AbortController|null>(null);

  const loadStats=useCallback(async(targetSpaceId?:string)=>{
    const request=++statsRequestRef.current;
    statsAbortRef.current?.abort();
    const controller=new AbortController();statsAbortRef.current=controller;
    try{
      const params=new URLSearchParams({month});
      if(targetSpaceId)params.set('spaceId',targetSpaceId);
      const url=`/api/stats?${params}`;
      const result=await cachedJson<Stats&{error?:string}>(url,{signal:controller.signal,onRevalidate:value=>{if(request===statsRequestRef.current&&!value.error)setStats(value)}});
      if(request===statsRequestRef.current&&!result.error)setStats(result);
    }catch(error:any){if(error?.name!=='AbortError'&&request===statsRequestRef.current)setStats(null)}
  },[month]);

  const loadRecent=useCallback(async(targetSpaceId?:string)=>{
    const request=++recentRequestRef.current;
    recentAbortRef.current?.abort();
    const controller=new AbortController();recentAbortRef.current=controller;
    setRecentLoading(true);setRecentError('');
    try{
      const suffix=targetSpaceId?`&spaceId=${encodeURIComponent(targetSpaceId)}`:'';
      const categorySuffix=targetSpaceId?`?spaceId=${encodeURIComponent(targetSpaceId)}`:'';
      const transactionUrl=`/api/transactions?page=1&size=5${suffix}`,categoryUrl=`/api/categories${categorySuffix}`;
      const [transactionResult,categoryResult]=await Promise.all([
        cachedJson<{data?:RecentTransaction[];error?:string}>(transactionUrl,{signal:controller.signal,onRevalidate:value=>{if(request===recentRequestRef.current)setRecent(Array.isArray(value.data)?value.data.slice(0,5):[])}}),
        cachedJson<{data?:RecentCategory[]}>(categoryUrl,{signal:controller.signal,onRevalidate:value=>{if(request===recentRequestRef.current)setRecentCategories(Array.isArray(value.data)?value.data:[])}}),
      ]);
      if(request!==recentRequestRef.current)return;
      if(transactionResult.error)throw new Error(transactionResult.error||'Impossibile caricare i movimenti recenti.');
      setRecent(Array.isArray(transactionResult.data)?transactionResult.data.slice(0,5):[]);
      setRecentCategories(Array.isArray(categoryResult.data)?categoryResult.data:[]);
    }catch(error:any){if(error?.name!=='AbortError'&&request===recentRequestRef.current){setRecent([]);setRecentError(error?.message||'Impossibile caricare i movimenti recenti.')}}
    finally{if(request===recentRequestRef.current)setRecentLoading(false)}
  },[]);

  useEffect(()=>{
    setStats(null);
    loadStats();
    const onFocus=()=>loadStats();
    window.addEventListener('focus',onFocus);
    return()=>{window.removeEventListener('focus',onFocus);statsAbortRef.current?.abort()};
  },[loadStats]);

  useEffect(()=>{void loadRecent();return()=>recentAbortRef.current?.abort()},[loadRecent]);
  useEffect(()=>onActiveSpaceChanged(spaceId=>{
    statsRequestRef.current++;
    recentRequestRef.current++;
    statsAbortRef.current?.abort();
    recentAbortRef.current?.abort();
    setStats(null);
    setRecent([]);
    loadStats(spaceId);
    loadRecent(spaceId);
  }),[loadStats,loadRecent]);

  return <>
    <header className="page-head home-head"><div className="home-brand"><QoomiaLogo size={42}/><div><h1>Qoomia</h1><p>{t('home.subtitle')}</p></div></div><MonthPicker value={month} onChange={setMonth}/></header>

    <section className={`balance-card${stats?'':' is-loading'}`} aria-busy={!stats}>
      <header><Icon name="wallet" size={18}/><span>{t('home.monthBalance')}</span><Icon name="chart" size={20}/></header>
      <strong>{stats?currency(stats.balance):<Skeleton className="ui-skeleton-balance"/>}</strong>
      <div className="balance-average"><span>{t('home.dailyAverage')}</span><b>{stats?currency(stats.dailyAverageExpense):<Skeleton width="88px" height="18px"/>}</b><small>{stats?(stats.daysConsidered?(stats.daysConsidered===1?t('home.elapsedOne'):t('home.elapsedMany',{count:stats.daysConsidered})):t('home.noElapsed')):<Skeleton width="132px" height="11px"/>}</small></div>
    </section>

    <div className="money-grid">
      <section className={`money-card surface${stats?'':' is-loading'}`}><header><span>{t('common.incomes')}</span><Icon name="arrowUp" size={16}/></header><strong className="green">{stats?currency(stats.income):<Skeleton width="96px" height="22px"/>}</strong></section>
      <section className={`money-card surface${stats?'':' is-loading'}`}><header><span>{t('common.expenses')}</span><Icon name="arrowDown" size={16}/></header><strong className="red">{stats?currency(stats.expense):<Skeleton width="96px" height="22px"/>}</strong></section>
    </div>

    <MonthlyInsightCard stats={stats} month={month} currency={currency} locale={locale}/>

    <Link href="/budget" prefetch className={`section surface home-budget-summary home-budget-link home-budget-teaser${stats?.budget.status?` ${stats.budget.status}`:''}`} aria-label="Apri Budget">
      {stats?<><div className="home-budget-teaser-row"><div><h2>Budget</h2><small>{stats.budget.amount?`${stats.budget.percentage}% utilizzato · ${currency(stats.budget.available)} disponibili`:`Budget non impostato · ${currency(stats.budget.spent)} spesi`}</small></div><span className="home-budget-teaser-spent"><small>Speso</small><strong>{currency(stats.budget.spent)}</strong></span><span className="home-budget-chevron" aria-hidden="true">›</span></div>{stats.budget.amount>0&&<div className={`budget-progress ${stats.budget.status}`}><span style={{width:`${Math.min(100,stats.budget.percentage)}%`}}/></div>}</>:<div className="home-budget-teaser-loading"><Skeleton width="38%" height="16px"/><Skeleton width="72%" height="11px"/></div>}
    </Link>

    <section className="section surface home-recent">
      <div className="section-title"><div><h2>Movimenti recenti</h2><small>Ultime operazioni nello spazio</small></div><Link href="/movimenti">Vedi tutti</Link></div>
      {recentLoading&&!recent.length?<SkeletonRows rows={4}/>:recentError?<InlineError message={recentError} onRetry={()=>void loadRecent()}/>:recent.length?<div className="home-recent-list">{recent.map(row=>{const metadata=recentCategories.find(item=>item.name===row.category_name);return <Link href="/movimenti" className="home-recent-row" key={row.id}><CategoryIcon name={row.category_name} icon={metadata?.icon||undefined} color={metadata?.color||undefined} size={40}/><span><b>{row.note||row.category_name}</b><small>{row.category_name} · {new Intl.DateTimeFormat(localeTag,{day:'numeric',month:'short'}).format(new Date(`${row.date}T12:00:00`))}</small></span><strong className={Number(row.amount)>=0?'green':'red'}>{Number(row.amount)>=0?'+ ':''}{currency(Number(row.amount))}</strong></Link>})}</div>:<div className="home-recent-empty"><p>Nessun movimento nello spazio selezionato.</p><Link href="/nuovo">Aggiungi il primo</Link></div>}
    </section>

  </>;
}

