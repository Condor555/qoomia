'use client';

import Link from 'next/link';
import Icon from './Icon';
import CategoryIcon from './CategoryIcon';
import {Skeleton} from './UXFeedback';

type TopCategory={name:string;value:number;changePercent:number|null;comparison:'available'|'no-previous-data';icon?:string|null;color?:string|null};
type InsightStats={
  expense:number;
  dailyAverageExpense:number;
  topCategory:TopCategory|null;
  budget:{amount:number;available:number;percentage:number;status:'ok'|'warning'|'over';projected:number;projectedOverage:number};
};

type InsightIcon=
  |{kind:'category';name:string;icon?:string|null;color?:string|null}
  |{kind:'budget'|'trend'};
type Insight={title:string;description:string;href:string;tone:'positive'|'attention'|'neutral';icon:InsightIcon};

type Props={stats:InsightStats|null;currency:(value:number)=>string};

function insightFor(stats:InsightStats,currency:(value:number)=>string):Insight{
  const {budget,topCategory}=stats;
  if(budget.amount>0&&budget.status==='over'){
    return {
      title:'Budget oltre il limite',
      description:budget.projectedOverage>0
        ?`Hai superato il budget mensile di ${currency(Math.abs(budget.available))}. Proiezione attuale: ${currency(budget.projected)} a fine mese.`
        :`Hai superato il budget mensile di ${currency(Math.abs(budget.available))}.`,
      href:'/budget',tone:'attention',icon:{kind:'budget'},
    };
  }
  if(budget.amount>0&&budget.status==='warning'){
    return {
      title:'Budget da tenere d’occhio',
      description:`Hai utilizzato il ${Math.round(budget.percentage)}% del budget mensile e restano ${currency(Math.max(0,budget.available))} disponibili.`,
      href:'/budget',tone:'attention',icon:{kind:'budget'},
    };
  }
  if(topCategory?.comparison==='available'&&topCategory.changePercent!=null&&Math.abs(topCategory.changePercent)>=10){
    const rising=topCategory.changePercent>0;
    return {
      title:`${topCategory.name} ${rising?'in aumento':'in calo'}`,
      description:`${currency(topCategory.value)} nel mese, ${Math.abs(Math.round(topCategory.changePercent))}% ${rising?'in più':'in meno'} rispetto al mese precedente.`,
      href:'/statistiche',tone:rising?'attention':'positive',
      icon:{kind:'category',name:topCategory.name,icon:topCategory.icon,color:topCategory.color},
    };
  }
  if(stats.expense<=0){
    return {
      title:'Pronto per il primo insight',
      description:'Registra i movimenti del mese: Qoomia userà solo i dati già presenti per mostrarti un riepilogo utile.',
      href:'/nuovo',tone:'neutral',icon:{kind:'trend'},
    };
  }
  return {
    title:'Il mese in breve',
    description:`Hai registrato ${currency(stats.expense)} di spese nel mese, con una media giornaliera di ${currency(stats.dailyAverageExpense)}.`,
    href:'/statistiche',tone:'positive',icon:{kind:'trend'},
  };
}

export default function MonthlyInsightCard({stats,currency}:Props){
  if(!stats)return <section className="monthly-insight-card surface is-loading" aria-busy="true" aria-label="Caricamento insight"><span className="monthly-insight-icon"><Skeleton width="22px" height="22px"/></span><div><Skeleton width="104px" height="11px"/><Skeleton width="72%" height="20px"/><Skeleton width="92%" height="13px"/></div></section>;
  const insight=insightFor(stats,currency);
  const icon=insight.icon.kind==='category'
    ?<CategoryIcon name={insight.icon.name} icon={insight.icon.icon} color={insight.icon.color} size={42}/>
    :<Icon name={insight.icon.kind==='budget'?'wallet':'chart'} size={21}/>;
  return <Link href={insight.href} prefetch className={`monthly-insight-card surface ${insight.tone} ${insight.icon.kind}-insight`} aria-label={`${insight.title}. Apri il dettaglio`}>
    <span className="monthly-insight-icon" aria-hidden="true">{icon}</span>
    <span className="monthly-insight-copy"><small>Insight del mese</small><strong>{insight.title}</strong><span>{insight.description}</span></span>
    <span className="monthly-insight-chevron" aria-hidden="true">›</span>
  </Link>;
}
