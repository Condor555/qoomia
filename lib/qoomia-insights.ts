export type InsightTone='positive'|'attention'|'neutral';
export type InsightIcon=
  |{kind:'category';name:string;icon?:string|null;color?:string|null}
  |{kind:'budget'|'trend'|'projection'};

export type QoomiaInsight={
  id:string;
  title:string;
  description:string;
  href:string;
  tone:InsightTone;
  icon:InsightIcon;
  priority:number;
  actionLabel?:string;
};

type Category={name:string;value:number;changePercent?:number|null;comparison?:'available'|'no-previous-data';icon?:string|null;color?:string|null};
type Budget={amount:number;spent?:number;available:number;percentage:number;status:'ok'|'warning'|'over';projected?:number|null;projectedOverage?:number};
type Forecast={projectedIncome:number;projectedExpense:number;projectedBalance:number;futureRecurringIncome:number;futureRecurringExpense:number;futureRecurringCount:number;confidence:'low'|'medium'|'high'};
export type InsightInput={
  month:string;
  periodStatus?:'past'|'current'|'future';
  expense:number;
  income?:number;
  balance?:number;
  previousExpense?:number;
  expenseChangePercent?:number|null;
  dailyAverageExpense?:number;
  projectedExpense?:number|null;
  daysConsidered?:number;
  daysInMonth?:number;
  budget:Budget;
  categories?:Category[];
  topCategory?:Category|null;
  forecast?:Forecast;
};

type BuildOptions={currency:(value:number)=>string;locale?:'it'|'en';limit?:number};

function movementHref(month:string,category?:string){
  const [year,monthNumber]=month.split('-').map(Number);
  const end=new Date(Date.UTC(year,monthNumber,0)).toISOString().slice(0,10);
  const params=new URLSearchParams({start:`${month}-01`,end});
  if(category)params.set('category',category);
  return `/movimenti?${params}`;
}

export function buildQoomiaInsights(input:InsightInput,{currency,locale='it',limit=3}:BuildOptions):QoomiaInsight[]{
  const it=locale==='it';
  const candidates:QoomiaInsight[]=[];
  const budget=input.budget;
  const projectedOverage=Math.max(0,Number(budget.projectedOverage||0));
  const projectedBudget=budget.projected==null?null:Number(budget.projected);
  const monthProgress=input.daysInMonth?Math.min(100,Math.round((Number(input.daysConsidered||0)/input.daysInMonth)*100)):0;
  const categories=(input.categories||[]).filter(category=>category.value>0).sort((a,b)=>b.value-a.value);
  const top=input.topCategory||categories[0]||null;

  if(input.periodStatus==='future'){
    candidates.push({id:'future',priority:100,tone:'neutral',icon:{kind:'projection'},href:'',actionLabel:undefined,title:it?'Il mese deve ancora iniziare':'The month has not started yet',description:it?'Gli insight compariranno quando saranno disponibili movimenti per il periodo selezionato.':'Insights will appear once transactions are available for the selected period.'});
  }

  if(input.periodStatus==='current'&&input.forecast){
    const forecast=input.forecast;const recurring=forecast.futureRecurringCount>0?(it?` Include ${currency(forecast.futureRecurringExpense)} di uscite ricorrenti future.`:` It includes ${currency(forecast.futureRecurringExpense)} in upcoming recurring expenses.`):'';
    if(forecast.projectedBalance<0)candidates.push({id:'negative-balance-forecast',priority:97,tone:'attention',icon:{kind:'projection'},href:'/statistiche#stats-forecast',actionLabel:it?'Apri previsione':'Open forecast',title:it?'Saldo previsto sotto zero':'Forecast balance below zero',description:it?`A fine mese il saldo stimato è ${currency(forecast.projectedBalance)}.${recurring}`:`The estimated month-end balance is ${currency(forecast.projectedBalance)}.${recurring}`});
    else candidates.push({id:'balance-forecast',priority:82,tone:'positive',icon:{kind:'projection'},href:'/statistiche#stats-forecast',actionLabel:it?'Apri previsione':'Open forecast',title:it?'Saldo previsto a fine mese':'Forecast month-end balance',description:it?`La stima è ${currency(forecast.projectedBalance)}: ${currency(forecast.projectedIncome)} di entrate e ${currency(forecast.projectedExpense)} di uscite.${recurring}`:`The estimate is ${currency(forecast.projectedBalance)}: ${currency(forecast.projectedIncome)} in income and ${currency(forecast.projectedExpense)} in expenses.${recurring}`});
  }

  if(budget.amount>0&&projectedOverage>0){
    candidates.push({id:'budget-projection-risk',priority:98,tone:'attention',icon:{kind:'budget'},href:'/budget',actionLabel:it?'Apri Budget':'Open Budget',title:it?'Budget a rischio superamento':'Budget at risk',description:it?`Al ritmo attuale potresti superarlo di ${currency(projectedOverage)} entro fine mese.`:`At the current pace you may exceed it by ${currency(projectedOverage)} by month-end.`});
  }else if(budget.amount>0&&budget.status==='over'){
    candidates.push({id:'budget-over',priority:96,tone:'attention',icon:{kind:'budget'},href:'/budget',actionLabel:it?'Apri Budget':'Open Budget',title:it?'Budget oltre il limite':'Budget over the limit',description:it?`Hai superato il budget di ${currency(Math.abs(budget.available))}. Apri il dettaglio per capire dove intervenire.`:`You are ${currency(Math.abs(budget.available))} over budget. Open the details to see where to act.`});
  }else if(budget.amount>0&&budget.percentage>=80&&budget.percentage>monthProgress+10){
    candidates.push({id:'budget-pace',priority:91,tone:'attention',icon:{kind:'budget'},href:'/budget',actionLabel:it?'Apri Budget':'Open Budget',title:it?'Budget più veloce del mese':'Budget is moving faster than the month',description:it?`Hai usato il ${Math.round(budget.percentage)}% del budget mentre il mese è al ${monthProgress}%.`:`You used ${Math.round(budget.percentage)}% of the budget while the month is ${monthProgress}% complete.`});
  }

  const expenseChange=input.expenseChangePercent;
  if(expenseChange!=null&&expenseChange>=25&&input.expense>0){
    candidates.push({id:'expense-spike',priority:94,tone:'attention',icon:{kind:'trend'},href:'/statistiche#stats-trend',actionLabel:it?'Vedi andamento':'View trend',title:it?'Spese sopra il mese scorso':'Spending above last month',description:it?`Le uscite sono aumentate del ${Math.round(expenseChange)}% rispetto allo stesso confronto mensile.`:`Expenses increased by ${Math.round(expenseChange)}% compared with last month.`});
  }else if(expenseChange!=null&&expenseChange<=-15&&input.expense>0){
    candidates.push({id:'expense-down',priority:78,tone:'positive',icon:{kind:'trend'},href:'/statistiche#stats-trend',actionLabel:it?'Vedi andamento':'View trend',title:it?'Spese in calo':'Spending is down',description:it?`Hai speso il ${Math.abs(Math.round(expenseChange))}% in meno rispetto al mese precedente.`:`You spent ${Math.abs(Math.round(expenseChange))}% less than in the previous month.`});
  }

  if(input.periodStatus==='current'&&input.projectedExpense!=null&&Number(input.previousExpense||0)>0){
    const delta=(input.projectedExpense-input.previousExpense!)/input.previousExpense!*100;
    if(Math.abs(delta)>=15){
      const up=delta>0;
      candidates.push({id:'month-projection',priority:up?88:73,tone:up?'attention':'positive',icon:{kind:'projection'},href:'/statistiche#stats-trend',actionLabel:it?'Vedi andamento':'View trend',title:it?(up?'Proiezione mensile in aumento':'Proiezione mensile in calo'):(up?'Monthly projection is rising':'Monthly projection is falling'),description:it?`La stima di fine mese è ${currency(input.projectedExpense)}, ${Math.abs(Math.round(delta))}% ${up?'sopra':'sotto'} il mese scorso.`:`The month-end estimate is ${currency(input.projectedExpense)}, ${Math.abs(Math.round(delta))}% ${up?'above':'below'} last month.`});
    }
  }

  if(top?.comparison==='available'&&top.changePercent!=null&&Math.abs(top.changePercent)>=20){
    const rising=top.changePercent>0;
    candidates.push({id:`category-change:${top.name}`,priority:rising?86:70,tone:rising?'attention':'positive',icon:{kind:'category',name:top.name,icon:top.icon,color:top.color},href:movementHref(input.month,top.name),actionLabel:it?'Vedi movimenti':'View transactions',title:`${top.name} ${it?(rising?'in aumento':'in calo'):(rising?'is rising':'is falling')}`,description:it?`${currency(top.value)} nel mese, ${Math.abs(Math.round(top.changePercent))}% ${rising?'in più':'in meno'} rispetto al mese precedente.`:`${currency(top.value)} this month, ${Math.abs(Math.round(top.changePercent))}% ${rising?'more':'less'} than last month.`});
  }

  if(top&&input.expense>0){
    const share=Math.round(top.value/input.expense*100);
    if(share>=35)candidates.push({id:`category-weight:${top.name}`,priority:64,tone:'neutral',icon:{kind:'category',name:top.name,icon:top.icon,color:top.color},href:movementHref(input.month,top.name),actionLabel:it?'Vedi movimenti':'View transactions',title:it?`${top.name} pesa di più`:`${top.name} has the largest share`,description:it?`Rappresenta il ${share}% delle uscite del mese, pari a ${currency(top.value)}.`:`It represents ${share}% of monthly expenses, equal to ${currency(top.value)}.`});
  }

  if(budget.amount>0&&budget.status==='ok'&&budget.percentage<=monthProgress+10&&input.periodStatus==='current'){
    candidates.push({id:'budget-on-track',priority:58,tone:'positive',icon:{kind:'budget'},href:'/budget',actionLabel:it?'Apri Budget':'Open Budget',title:it?'Budget in linea':'Budget on track',description:it?`Hai usato il ${Math.round(budget.percentage)}% del budget al ${monthProgress}% del mese. Restano ${currency(Math.max(0,budget.available))}.`:`You used ${Math.round(budget.percentage)}% of the budget at ${monthProgress}% of the month. ${currency(Math.max(0,budget.available))} remains.`});
  }

  if(input.expense<=0&&input.periodStatus!=='future'){
    candidates.push({id:'empty',priority:90,tone:'neutral',icon:{kind:'trend'},href:'/nuovo',actionLabel:it?'Aggiungi movimento':'Add transaction',title:it?'Pronto per il primo insight':'Ready for your first insight',description:it?'Registra i movimenti del mese: Qoomia analizzerà solo i dati già presenti.':'Record this month’s transactions: Qoomia will analyse only the data already available.'});
  }else if(input.expense>0){
    candidates.push({id:'summary',priority:10,tone:'neutral',icon:{kind:'trend'},href:'/statistiche#stats-categories',actionLabel:it?'Vedi categorie':'View categories',title:it?'Il mese in breve':'The month in brief',description:it?`Hai registrato ${currency(input.expense)} di uscite${input.dailyAverageExpense!=null?`, con una media di ${currency(input.dailyAverageExpense)} al giorno`:''}.`:`You recorded ${currency(input.expense)} in expenses${input.dailyAverageExpense!=null?`, averaging ${currency(input.dailyAverageExpense)} per day`:''}.`});
  }

  const unique=new Map<string,QoomiaInsight>();
  for(const item of candidates.sort((a,b)=>b.priority-a.priority))if(!unique.has(item.id))unique.set(item.id,item);
  return [...unique.values()].slice(0,Math.max(1,limit));
}
