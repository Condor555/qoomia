'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Icon from '../components/Icon';
import CategoryIcon from '../components/CategoryIcon';
import MonthPicker from '../components/MonthPicker';
import {categoryStyle} from '../lib/category-style';
import {onActiveSpaceChanged} from '../lib/active-space-client';
import {useSharedMonth} from '../lib/selected-period-client';
import {useI18n} from '../components/LanguageProvider';
import QoomiaLogo from '../components/QoomiaLogo';

type TopCategory={name:string;value:number;percentage:number;previousValue:number;changePercent:number|null;comparison:'available'|'no-previous-data'};
type Stats={
  income:number;
  expense:number;
  balance:number;
  count:number;
  dailyAverageExpense:number;
  daysConsidered:number;
  daysInMonth:number;
  topCategory:TopCategory|null;
  categories:{name:string;value:number}[];
  budget:{amount:number;projected:number;projectedOverage:number;commitments:number;distributable:number};
  savingGoals:Array<{id:string;name:string;icon:string;color:string;targetAmount:number;accumulated:number;remaining:number;progress:number;targetDate:string|null}>;
};
type Trend={month:string;income:number;expense:number};
const HomeTrendChart=dynamic(()=>import('../components/HomeTrendChart'),{ssr:false,loading:()=> <div className="chart-skeleton" aria-label="Caricamento grafico"/>});

export default function Home(){
  const {currency,localeTag,t}=useI18n();
  const {month,setMonth}=useSharedMonth();
  const [stats,setStats]=useState<Stats|null>(null);
  const [trends,setTrends]=useState<Trend[]>([]);
  const statsRequestRef=useRef(0);
  const trendsRequestRef=useRef(0);
  const statsAbortRef=useRef<AbortController|null>(null);
  const trendsAbortRef=useRef<AbortController|null>(null);

  const loadStats=useCallback(async(targetSpaceId?:string)=>{
    const request=++statsRequestRef.current;
    statsAbortRef.current?.abort();
    const controller=new AbortController();statsAbortRef.current=controller;
    try{
      const params=new URLSearchParams({month});
      if(targetSpaceId)params.set('spaceId',targetSpaceId);
      const response=await fetch(`/api/stats?${params}`,{cache:'no-store',signal:controller.signal});
      const result=await response.json();
      if(request===statsRequestRef.current&&!result.error)setStats(result);
    }catch(error:any){if(error?.name!=='AbortError'&&request===statsRequestRef.current)setStats(null)}
  },[month]);

  const loadTrends=useCallback(async(targetSpaceId?:string)=>{
    const request=++trendsRequestRef.current;
    trendsAbortRef.current?.abort();
    const controller=new AbortController();trendsAbortRef.current=controller;
    try{
      const params=new URLSearchParams({month,months:'6'});
      if(targetSpaceId)params.set('spaceId',targetSpaceId);
      const result=await fetch(`/api/trends?${params}`,{cache:'no-store',signal:controller.signal}).then(response=>response.json());
      if(request===trendsRequestRef.current)setTrends((result.data||[]).slice(-6));
    }catch(error:any){if(error?.name!=='AbortError'&&request===trendsRequestRef.current)setTrends([])}
  },[month]);

  useEffect(()=>{
    setStats(null);
    loadStats();
    const onFocus=()=>loadStats();
    window.addEventListener('focus',onFocus);
    return()=>{window.removeEventListener('focus',onFocus);statsAbortRef.current?.abort()};
  },[loadStats]);

  useEffect(()=>{setTrends([]);loadTrends();return()=>trendsAbortRef.current?.abort()},[loadTrends]);
  useEffect(()=>onActiveSpaceChanged(spaceId=>{
    statsRequestRef.current++;
    trendsRequestRef.current++;
    statsAbortRef.current?.abort();
    trendsAbortRef.current?.abort();
    setStats(null);
    setTrends([]);
    loadStats(spaceId);
    loadTrends(spaceId);
  }),[loadStats,loadTrends]);

  const total=stats?.expense||1;
  const top=stats?.topCategory;
  const comparison=top?.changePercent==null
    ?t('home.noPreviousExpense')
    :t('home.vsLastMonth',{value:`${top.changePercent>0?'+':''}${top.changePercent}`});

  return <>
    <header className="page-head home-head"><div className="home-brand"><QoomiaLogo size={42}/><div><h1>Qoomia</h1><p>{t('home.subtitle')}</p></div></div><MonthPicker value={month} onChange={setMonth}/></header>

    <section className={`balance-card${stats?'':' is-loading'}`} aria-busy={!stats}>
      <header><Icon name="wallet" size={18}/><span>{t('home.monthBalance')}</span><Icon name="chart" size={20}/></header>
      <strong>{stats?currency(stats.balance):'—'}</strong>
      <div className="balance-average"><span>{t('home.dailyAverage')}</span><b>{stats?currency(stats.dailyAverageExpense):'—'}</b><small>{stats?(stats.daysConsidered?(stats.daysConsidered===1?t('home.elapsedOne'):t('home.elapsedMany',{count:stats.daysConsidered})):t('home.noElapsed')):'Caricamento…'}</small></div>
    </section>

    <div className="money-grid">
      <section className={`money-card surface${stats?'':' is-loading'}`}><header><span>{t('common.incomes')}</span><Icon name="arrowUp" size={16}/></header><strong className="green">{stats?currency(stats.income):'—'}</strong></section>
      <section className={`money-card surface${stats?'':' is-loading'}`}><header><span>{t('common.expenses')}</span><Icon name="arrowDown" size={16}/></header><strong className="red">{stats?currency(stats.expense):'—'}</strong></section>
    </div>

    <section className="section surface">
      <div className="section-title"><h2>{t('home.trend')}</h2><small>{t('home.lastSixMonths')}</small></div>
      <div className="home-chart"><HomeTrendChart data={trends} currency={currency} localeTag={localeTag} incomeLabel={t('common.incomes')} expenseLabel={t('common.expenses')}/></div>
      <div className="chart-key"><span><i className="key-green"/>{t('common.incomes')}</span><span><i className="key-red"/>{t('common.expenses')}</span></div>
    </section>

    {(stats?.budget?.projectedOverage||0)>0&&<section className="insight budget-projection-insight surface">
      <span className="insight-icon"><Icon name="chart" size={20}/></span>
      <div><small>{t('home.budgetProjection')}</small><b>{t('home.overrunRisk')}</b><p>{t('home.projectionOver',{projection:currency(stats?.budget.projected||0),overage:currency(stats?.budget.projectedOverage||0)})}</p><p>{t('home.commitments',{amount:currency(stats?.budget.commitments||0)})}</p></div>
    </section>}

    {top&&<section className="insight surface">
      <span className="insight-icon"><Icon name="chart" size={20}/></span>
      <div><small>{t('home.usual')}</small><b>{t('home.mainCategory',{name:top.name})}</b><p>{currency(top.value)} · {top.percentage}% {t('common.expenses').toLocaleLowerCase(localeTag)}</p><p className={top.changePercent==null?'insight-comparison neutral':top.changePercent>0?'insight-comparison up':'insight-comparison down'}>{comparison}</p></div>
    </section>}

    <section className="section surface home-saving-goals">
      <div className="section-title"><div><h2>{t('goals.homeTitle')}</h2><small>{t('goals.homeSubtitle')}</small></div><Link href="/obiettivi">{t('goals.viewAll')}</Link></div>
      {stats?.savingGoals?.slice(0,3).map(goal=><Link href="/obiettivi" className="home-goal-row" key={goal.id}><CategoryIcon name={goal.name} icon={goal.icon} color={goal.color} size={38}/><div><span><b>{goal.name}</b><strong>{goal.progress}%</strong></span><div className="progress"><i style={{width:`${goal.progress}%`,background:goal.color}}/></div><small>{t('goals.homeProgress',{saved:currency(goal.accumulated),target:currency(goal.targetAmount),remaining:currency(goal.remaining)})}</small></div></Link>)}
      {stats&&!stats.savingGoals.length&&<div className="home-goals-empty"><p>{t('goals.homeEmpty')}</p><Link href="/obiettivi">{t('goals.createFirst')}</Link></div>}
      {!stats&&<div className="home-goals-empty" aria-live="polite"><p>{t('goals.loading')}</p></div>}
    </section>

    <section className="section surface">
      <div className="section-title"><h2>{t('home.topCategories')}</h2><small>{stats?t('home.movementsCount',{count:stats.count}):'Caricamento…'}</small></div>
      {stats?.categories?.slice(0,5).map(category=>{
        const style=categoryStyle(category.name);
        return <div className="category-row" key={category.name}><CategoryIcon name={category.name}/><div className="category-main"><div className="category-row-head"><b>{category.name}</b><strong>{currency(category.value)}</strong></div><div className="category-progress-row"><div className="progress"><span style={{width:`${Math.max(4,category.value/(stats.categories[0]?.value||1)*100)}%`,background:style.color}}/></div><small className="category-percentage">{Math.round(category.value/total*100)}%</small></div></div></div>;
      })}
    </section>
  </>;
}
