'use client';

import Link from 'next/link';
import Icon from './Icon';
import {Skeleton} from './UXFeedback';

type TopCategory={name:string;value:number;changePercent:number|null;comparison:'available'|'no-previous-data'};
type InsightStats={
  expense:number;
  dailyAverageExpense:number;
  topCategory:TopCategory|null;
  budget:{amount:number;available:number;percentage:number;status:'ok'|'warning'|'over';projected:number;projectedOverage:number};
};

type Insight={title:string;description:string;detail:string;href:string;tone:'positive'|'attention'|'neutral'};

type Props={stats:InsightStats|null;currency:(value:number)=>string};

function insightFor(stats:InsightStats,currency:(value:number)=>string):Insight{
  const {budget,topCategory}=stats;
  if(budget.amount>0&&budget.status==='over'){
    return {
      title:'Budget oltre il limite',
      description:`Hai superato il budget mensile di ${currency(Math.abs(budget.available))}.`,
      detail:budget.projectedOverage>0?`Proiezione attuale: ${currency(budget.projected)} a fine mese.`:'Apri il Budget per vedere il dettaglio.',
      href:'/budget',tone:'attention',
    };
  }
  if(budget.amount>0&&budget.status==='warning'){
    return {
      title:'Budget da tenere d’occhio',
      description:`Hai utilizzato il ${Math.round(budget.percentage)}% del budget mensile.`,
      detail:`Restano ${currency(Math.max(0,budget.available))} disponibili.`,
      href:'/budget',tone:'attention',
    };
  }
  if(topCategory?.comparison==='available'&&topCategory.changePercent!=null&&Math.abs(topCategory.changePercent)>=10){
    const rising=topCategory.changePercent>0;
    return {
      title:`${topCategory.name} ${rising?'in aumento':'in calo'}`,
      description:`${currency(topCategory.value)} nel mese, ${Math.abs(Math.round(topCategory.changePercent))}% ${rising?'in più':'in meno'} rispetto al mese precedente.`,
      detail:'Apri Statistiche per approfondire l’andamento.',
      href:'/statistiche',tone:rising?'attention':'positive',
    };
  }
  if(stats.expense<=0){
    return {
      title:'Pronto per il primo insight',
      description:'Registra i movimenti del mese: Qoomia userà solo i dati già presenti per mostrarti un riepilogo utile.',
      detail:'Nessuna previsione artificiale e nessun dato aggiuntivo richiesto.',
      href:'/nuovo',tone:'neutral',
    };
  }
  return {
    title:'Il mese in breve',
    description:`Hai registrato ${currency(stats.expense)} di spese nel mese.`,
    detail:`La media giornaliera calcolata da Qoomia è ${currency(stats.dailyAverageExpense)}.`,
    href:'/statistiche',tone:'positive',
  };
}

export default function MonthlyInsightCard({stats,currency}:Props){
  if(!stats)return <section className="monthly-insight-card surface is-loading" aria-busy="true" aria-label="Caricamento insight"><span className="monthly-insight-icon"><Skeleton width="22px" height="22px"/></span><div><Skeleton width="104px" height="11px"/><Skeleton width="72%" height="20px"/><Skeleton width="92%" height="13px"/><Skeleton width="62%" height="11px"/></div></section>;
  const insight=insightFor(stats,currency);
  return <Link href={insight.href} prefetch className={`monthly-insight-card surface ${insight.tone}`} aria-label={`${insight.title}. Apri il dettaglio`}>
    <span className="monthly-insight-icon" aria-hidden="true"><Icon name={insight.tone==='attention'?'arrowUp':'chart'} size={22}/></span>
    <span className="monthly-insight-copy"><small>Insight del mese</small><strong>{insight.title}</strong><span>{insight.description}</span><em>{insight.detail}</em></span>
    <span className="monthly-insight-chevron" aria-hidden="true">›</span>
  </Link>;
}
