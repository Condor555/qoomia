'use client';

import Link from 'next/link';
import Icon from './Icon';
import CategoryIcon from './CategoryIcon';
import {Skeleton} from './UXFeedback';
import {buildQoomiaInsights} from '../lib/qoomia-insights';

type TopCategory={name:string;value:number;changePercent:number|null;comparison:'available'|'no-previous-data';icon?:string|null;color?:string|null};
type InsightStats={
  periodStatus?:'past'|'current'|'future';
  expense:number;
  income?:number;
  balance?:number;
  previousExpense?:number;
  expenseChangePercent?:number|null;
  projectedExpense?:number|null;
  dailyAverageExpense:number;
  daysConsidered?:number;
  daysInMonth?:number;
  smartFinance?:{projectedBalance:number;currentBalance:number;scheduledIncome:number;scheduledExpense:number;historicalIncome:number;projectedVariableExpense:number;confidence:'high'|'medium'|'low'}|null;
  topCategory:TopCategory|null;
  budget:{amount:number;spent?:number;available:number;percentage:number;status:'ok'|'warning'|'over';projected:number;projectedOverage:number};
};

type Props={stats:InsightStats|null;month:string;currency:(value:number)=>string;locale:'it'|'en'};

export default function MonthlyInsightCard({stats,month,currency,locale}:Props){
  if(!stats)return <section className="monthly-insight-card surface is-loading" aria-busy="true" aria-label={locale==='it'?'Caricamento insight':'Loading insight'}><span className="monthly-insight-icon"><Skeleton width="20px" height="20px"/></span><div><Skeleton width="104px" height="11px"/><Skeleton width="72%" height="20px"/><Skeleton width="92%" height="13px"/></div></section>;
  if(stats.periodStatus==='current'&&stats.smartFinance){
    const forecast=stats.smartFinance;const expectedIncome=forecast.scheduledIncome+forecast.historicalIncome;
    return <Link href="/statistiche?section=smart-finance#smart-finance" prefetch className={`monthly-insight-card surface ${forecast.projectedBalance>=0?'positive':'attention'} projection-insight`} aria-label={locale==='it'?'Apri previsione Smart Finance':'Open Smart Finance forecast'}>
      <span className="monthly-insight-icon" aria-hidden="true"><Icon name="chart" size={19}/></span>
      <span className="monthly-insight-copy"><small>Smart Finance</small><strong>{locale==='it'?`Saldo previsto ${currency(forecast.projectedBalance)}`:`Forecast balance ${currency(forecast.projectedBalance)}`}</strong><span>{locale==='it'?`${currency(forecast.currentBalance)} attuali + ${currency(expectedIncome)} entrate attese − ${currency(forecast.scheduledExpense+forecast.projectedVariableExpense)} uscite stimate.`:`${currency(forecast.currentBalance)} now + ${currency(expectedIncome)} expected income − ${currency(forecast.scheduledExpense+forecast.projectedVariableExpense)} estimated expenses.`}</span></span>
      <span className="monthly-insight-chevron" aria-hidden="true">›</span>
    </Link>;
  }
  const [insight]=buildQoomiaInsights({
    month,
    periodStatus:stats.periodStatus,
    expense:stats.expense,
    income:stats.income,
    balance:stats.balance,
    previousExpense:stats.previousExpense,
    expenseChangePercent:stats.expenseChangePercent,
    projectedExpense:stats.projectedExpense,
    dailyAverageExpense:stats.dailyAverageExpense,
    daysConsidered:stats.daysConsidered,
    daysInMonth:stats.daysInMonth,
    budget:stats.budget,
    topCategory:stats.topCategory,
    categories:stats.topCategory?[stats.topCategory]:[],
  },{currency,locale,limit:1});
  if(!insight)return null;
  const icon=insight.icon.kind==='category'
    ?<CategoryIcon name={insight.icon.name} icon={insight.icon.icon} color={insight.icon.color} size={36}/>
    :<Icon name={insight.icon.kind==='budget'?'wallet':'chart'} size={19}/>;
  return <Link href="/statistiche#qoomia-insights" prefetch className={`monthly-insight-card surface ${insight.tone} ${insight.icon.kind}-insight`} aria-label={`${insight.title}. ${locale==='it'?'Apri Qoomia Insights':'Open Qoomia Insights'}`}>
    <span className="monthly-insight-icon" aria-hidden="true">{icon}</span>
    <span className="monthly-insight-copy"><small>{locale==='it'?'Insight del mese':'Monthly insight'}</small><strong>{insight.title}</strong><span>{insight.description}</span></span>
    <span className="monthly-insight-chevron" aria-hidden="true">›</span>
  </Link>;
}

