'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import {useCallback,useEffect,useRef,useState} from 'react';
import {MinusIcon,PlusIcon} from '@phosphor-icons/react/ssr';
import CategoryIcon from '../../components/CategoryIcon';
import {useI18n} from '../../components/LanguageProvider';
import MonthPicker from '../../components/MonthPicker';
import {onActiveSpaceChanged} from '../../lib/active-space-client';
import {useSharedMonth} from '../../lib/selected-period-client';
import {InlineError,Skeleton,SkeletonRows} from '../../components/UXFeedback';
import {cachedJson} from '../../lib/client-json-cache';

type Category={name:string;value:number;budget:number;budgetPercentage:number;icon?:string|null;color?:string|null};
type Author={userId:string;name:string;value:number;percentage:number};
type Budget={amount:number;spent:number;available:number;percentage:number;status:'ok'|'warning'|'over';commitments:number;distributable:number;projected:number|null;projectedOverage:number};
type MacroCategory={name:string;spent:number;fixedSpent:number;discretionarySpent:number};
type Macro={id:string;name:string;color:string;hasAllocation:boolean;allocatedBudget:number;budget:number;spent:number;discretionarySpent:number;fixedSpent:number;available:number;percentage:number;status:'ok'|'warning'|'over';commitments:number;rolloverAmount:number;projected:number|null;projectedDiscretionary:number;projectedPercentage:number|null;categories:MacroCategory[]};
type Stats={month:string;periodStatus:'past'|'current'|'future';expense:number;income:number;balance:number;count:number;previousIncome:number;previousExpense:number;incomeChangePercent:number|null;expenseChangePercent:number|null;categories:Category[];incomeSources:Array<{name:string;value:number;percentage:number;icon?:string|null;color?:string|null}>;authors:Author[];dailyAverageExpense:number;projectedExpense:number|null;daysConsidered:number;daysInMonth:number;budget:Budget;macroCategories:Macro[];savingGoals:Array<{id:string;name:string;icon:string;color:string;targetAmount:number;accumulated:number;remaining:number;progress:number;suggestedMonthly:number|null;forecastDate:string|null}>};
type Trend={month:string;income:number;expense:number};
const CategoryDonutChart=dynamic(()=>import('../../components/StatisticsCharts').then(module=>module.CategoryDonutChart),{ssr:false,loading:()=> <div className="ui-skeleton ui-skeleton-chart"/>});
const TrendBarChart=dynamic(()=>import('../../components/StatisticsCharts').then(module=>module.TrendBarChart),{ssr:false,loading:()=> <div className="ui-skeleton ui-skeleton-chart"/>});

export default function Statistiche(){
  const {currency,localeTag,t}=useI18n();
  const {month,setMonth}=useSharedMonth();
  const [stats,setStats]=useState<Stats|null>(null),[trends,setTrends]=useState<Trend[]>([]),[trendMonths,setTrendMonths]=useState<6|12>(6),[spaceId,setSpaceId]=useState(''),[error,setError]=useState('');
  const [expandedMacros,setExpandedMacros]=useState<Record<string,boolean>>({});
  const statsRequestRef=useRef(0),trendsRequestRef=useRef(0),statsAbort=useRef<AbortController|null>(null),trendsAbort=useRef<AbortController|null>(null);
  const comparison=(value:number|null)=>value==null?t('stats.noPrevious'):t('stats.vsPrevious',{value:`${value>0?'+':''}${value}`});

  const loadStats=useCallback(async(targetSpaceId=spaceId)=>{const request=++statsRequestRef.current;statsAbort.current?.abort();const controller=new AbortController();statsAbort.current=controller;const params=new URLSearchParams({month});if(targetSpaceId)params.set('spaceId',targetSpaceId);setError('');try{const url=`/api/stats?${params}`;const result=await cachedJson<Stats>(url,{signal:controller.signal,onRevalidate:value=>{if(request===statsRequestRef.current)setStats(value)}});if(request!==statsRequestRef.current)return;setStats(result)}catch(reason:unknown){const cause=reason as {name?:string;message?:string};if(cause?.name!=='AbortError'&&request===statsRequestRef.current){setStats(null);setError(cause.message||t('stats.loadError'))}}},[month,spaceId,t]);
  const loadTrends=useCallback(async(targetSpaceId=spaceId)=>{const request=++trendsRequestRef.current;trendsAbort.current?.abort();const controller=new AbortController();trendsAbort.current=controller;const params=new URLSearchParams({month,months:String(trendMonths)});if(targetSpaceId)params.set('spaceId',targetSpaceId);try{const url=`/api/trends?${params}`;const result=await cachedJson<{data?:Trend[]}>(url,{signal:controller.signal,onRevalidate:value=>{if(request===trendsRequestRef.current)setTrends(value.data||[])}});if(request===trendsRequestRef.current)setTrends(result.data||[])}catch(reason:unknown){const cause=reason as {name?:string};if(cause?.name!=='AbortError'&&request===trendsRequestRef.current)setTrends([])}},[month,trendMonths,spaceId]);
  useEffect(()=>{setStats(null);void loadStats();return()=>statsAbort.current?.abort()},[loadStats]);
  useEffect(()=>{setTrends([]);void loadTrends();return()=>trendsAbort.current?.abort()},[loadTrends]);
  useEffect(()=>onActiveSpaceChanged(id=>{statsRequestRef.current++;trendsRequestRef.current++;statsAbort.current?.abort();trendsAbort.current?.abort();setSpaceId(id);setStats(null);setTrends([])}),[]);

  const categories=stats?.categories.slice(0,6)||[],total=stats?.expense||1;
  const reportStart=`${month}-01`;
  const [reportYear,reportMonth]=month.split('-').map(Number);
  const reportEndDate=new Date(Date.UTC(reportYear,reportMonth,0));
  const reportEnd=reportEndDate.toISOString().slice(0,10);
  const categoryReportHref=(name:string)=>`/movimenti?category=${encodeURIComponent(name)}&start=${reportStart}&end=${reportEnd}`;
  const selectedMonthName=stats?new Intl.DateTimeFormat(localeTag,{month:'long',timeZone:'UTC'}).format(new Date(`${stats.month}-01T00:00:00Z`)):'';
  const projectionCard=!stats
    ?{label:t('stats.projection'),value:'—',subtitle:'Caricamento…'}
    :stats.periodStatus==='past'
    ?{label:t('stats.completedBalance'),value:`${stats.balance>0?'+':''}${currency(stats.balance)}`,subtitle:t('stats.completedSubtitle')}
    :stats?.periodStatus==='future'
      ?{label:t('stats.future'),value:'—',subtitle:t('stats.futureSubtitle')}
      :{label:t('stats.projection'),value:currency(stats?.projectedExpense||0),subtitle:(stats?.expense||0)>0?t('stats.projectionSubtitle',{day:stats?.daysInMonth||0,month:selectedMonthName,average:currency(stats?.dailyAverageExpense||0)}):t('stats.noExpensesYet')};

  return <>
    <header className="page-head stats-head"><div><h1>{t('stats.title')}</h1><p>{t('stats.subtitle')}</p></div><MonthPicker value={month} onChange={setMonth}/></header>
    {error&&<InlineError message={error} onRetry={()=>void loadStats()}/>} 
    <div className="analytics-kpis">
      <section className={`metric surface${stats?'':' is-loading'}`}><small>{t('common.expenses')}</small><b className="red">{stats?currency(stats.expense):<Skeleton width="88px" height="21px"/>}</b><span>{stats?comparison(stats.expenseChangePercent):<Skeleton width="110px" height="11px"/>}</span></section>
      <section className={`metric surface${stats?'':' is-loading'}`}><small>{t('common.incomes')}</small><b className="green">{stats?currency(stats.income):<Skeleton width="88px" height="21px"/>}</b><span>{stats?comparison(stats.incomeChangePercent):<Skeleton width="110px" height="11px"/>}</span></section>
      <section className={`metric surface${stats?'':' is-loading'}`}><small>{t('stats.dailyAverage')}</small><b>{stats?currency(stats.dailyAverageExpense):<Skeleton width="78px" height="21px"/>}</b><span>{stats?t('stats.daysConsidered',{count:stats.daysConsidered}):<Skeleton width="96px" height="11px"/>}</span></section>
      <section className="metric surface"><small>{projectionCard.label}</small><b>{stats?projectionCard.value:<Skeleton width="84px" height="21px"/>}</b><span>{stats?projectionCard.subtitle:<Skeleton width="116px" height="11px"/>}</span></section>
    </div>
    {!stats&&!error&&<section className="section surface analytics-loading" aria-label="Caricamento statistiche"><Skeleton width="42%" height="18px"/><Skeleton className="ui-skeleton-chart"/><SkeletonRows rows={4}/></section>}
    {stats&&<>
    <section className="section surface"><div className="section-title"><div><small>{t('stats.topCategories')}</small><h2>{t('stats.expensesTotal',{amount:currency(stats.expense)})}</h2></div></div><div className="donut-wrap category-donut-wrap"><CategoryDonutChart categories={categories} currency={currency}/><div className="donut-center"><small>{t('stats.expensesCenter')}</small><b>{currency(stats.expense)}</b></div></div><div className="category-report-list">{categories.map(category=><Link href={categoryReportHref(category.name)} className="category-report-row" key={category.name}><CategoryIcon name={category.name} icon={category.icon} color={category.color} size={36}/><span><b>{category.name}</b><small>{currency(category.value)}</small></span><strong>{Math.round(category.value/total*100)}%</strong></Link>)}</div></section>
    <section className="section surface"><div className="section-title"><div><h2>{t('stats.trend')}</h2><small>{t('stats.periodEnds')}</small></div><div className="trend-toggle"><button className={trendMonths===6?'active':''} onClick={()=>setTrendMonths(6)}>{t('stats.sixMonths')}</button><button className={trendMonths===12?'active':''} onClick={()=>setTrendMonths(12)}>{t('stats.twelveMonths')}</button></div></div><div className="stat-chart"><TrendBarChart data={trends} currency={currency} incomeLabel={t('common.incomes')} expenseLabel={t('common.expenses')}/></div></section>
    <section className="section surface analytics-macros"><div className="section-title"><div><h2>{t('stats.macros')}</h2><small>{t('stats.macrosSub')}</small></div><Link href="/budget">{t('common.manage')}</Link></div><div>{stats.macroCategories.map(item=><details key={item.id} onToggle={event=>{const open=event.currentTarget.open;setExpandedMacros(current=>current[item.id]===open?current:{...current,[item.id]:open})}}><summary aria-expanded={Boolean(expandedMacros[item.id])} aria-label={expandedMacros[item.id]?`${t('common.close')}: ${item.name}`:t('budget.openMacro',{name:item.name})}><i style={{background:item.color}}/><span><b>{item.name}</b><small>{item.hasAllocation?t('stats.discretionarySpentOf',{spent:currency(item.discretionarySpent),budget:currency(item.allocatedBudget)}):t('stats.macroBudgetNotSet')}{item.projected!=null?` · ${t('stats.projection').toLocaleLowerCase(localeTag)} ${currency(item.projected)}`:''}</small><small>{t('stats.commitmentsSeparate',{amount:currency(item.commitments)})}</small>{item.hasAllocation&&<em className={`macro-summary-percentage ${(item.projectedPercentage??item.percentage)>100?'red':''}`.trim()}>{item.percentage}%</em>}</span><span className="macro-expander" aria-hidden="true">{expandedMacros[item.id]?<MinusIcon size={20} weight="bold"/>:<PlusIcon size={20} weight="bold"/>}</span></summary><div className="analytics-macro-detail">{item.hasAllocation&&<div className="budget-progress"><span style={{width:`${Math.min(100,item.percentage)}%`,background:item.status==='over'?'var(--red)':item.status==='warning'?'#f59e0b':item.color}}/></div>}<div className="budget-numbers"><span>{t('stats.commitmentsRollover',{commitments:currency(item.commitments),rollover:currency(item.rolloverAmount)})}</span><b className={item.hasAllocation&&item.available<0?'red':''}>{item.hasAllocation?`${currency(item.available)} ${t('common.available')}`:t('budget.notSet')}</b></div>{item.categories.length?item.categories.map(category=><div className="analytics-macro-category category-report-row" key={category.name}><CategoryIcon name={category.name} size={32}/><span><b>{category.name}</b><small>{item.hasAllocation?`${category.fixedSpent?`${currency(category.fixedSpent)} ${t('stats.fixed')} · `:''}${currency(category.discretionarySpent)} ${t('stats.discretionary')}`:t('common.expenses')}</small></span><strong>{currency(category.spent)}</strong></div>):<p>{t('stats.noAssigned')}</p>}</div></details>)}</div></section>
    <section className="section surface income-sources"><div className="section-title"><div><h2>{t('stats.incomeSources')}</h2><small>{t('stats.incomeSourcesSub')}</small></div><b className="green">{currency(stats.income)}</b></div>{stats.incomeSources.length?stats.incomeSources.map(item=><div className="income-source-row" key={item.name}><CategoryIcon name={item.name} icon={item.icon} color={item.color} size={36}/><span><b>{item.name}</b><small>{t('stats.incomeShare',{value:item.percentage})}</small></span><strong className="green">{currency(item.value)}</strong></div>):<p>{t('stats.noIncome')}</p>}</section>
    <section className={`section surface analytics-budget ${stats?.budget.status||'ok'}`}><div className="section-title"><div><h2>{t('stats.budgetTrend')}</h2><small>{stats?.budget.amount?t('stats.budgetUsed',{spent:currency(stats.budget.spent),budget:currency(stats.budget.amount),commitments:currency(stats.budget.commitments)}):t('stats.noBudget')}</small></div><Link href="/budget">{t('common.manage')}</Link></div>{Boolean(stats?.budget.amount)&&<div className="budget-progress"><span style={{width:`${Math.min(100,stats?.budget.percentage||0)}%`}}/></div>}<div className="budget-numbers"><span>{stats?.budget.amount?(stats.budget.projected!=null?t('stats.usedProjection',{percent:stats.budget.percentage,projection:currency(stats.budget.projected)}):`${stats.budget.percentage}%`):t('budget.notSet')}</span>{Boolean(stats?.budget.amount)&&<b className={(stats?.budget.available||0)<0?'red':''}>{`${currency(stats?.budget.available||0)} ${t('common.available')}`}</b>}</div>{(stats?.budget.projectedOverage||0)>0&&<div className="budget-warning">{t('stats.overBudget',{amount:currency(stats?.budget.projectedOverage||0)})}</div>}</section>
    {(stats?.authors.length||0)>1&&<section className="section surface"><div className="section-title"><div><h2>{t('stats.byAuthor')}</h2><small>{t('stats.byAuthorSub')}</small></div></div><div className="author-breakdown">{stats?.authors.map(author=><div key={author.userId}><span><b>{author.name}</b><small>{author.percentage}%</small></span><div className="progress"><i style={{width:`${author.percentage}%`}}/></div><strong>{currency(author.value)}</strong></div>)}</div></section>}
    <div className="metric-grid"><section className="metric surface"><small>{t('common.balance')}</small><b>{currency(stats.balance)}</b></section><section className="metric surface"><small>{t('stats.savingsRate')}</small><b>{stats.income?`${Math.round(stats.balance/stats.income*100)}%`:'—'}</b></section></div>
    </>}
  </>;
}
