import {addRecurringDate,type RecurrenceFrequency} from './recurrence';

export type SmartFinanceTransaction={
  amount:number|string;
  category_name:string;
  date:string;
  note?:string|null;
  source?:string|null;
};

export type SmartFinanceRecurring={
  id:string;
  note?:string|null;
  category_name:string;
  amount:number|string;
  next_run:string;
  frequency:RecurrenceFrequency;
  interval_count:number;
  active?:boolean;
  categoryKind?:'expense'|'income'|null;
};

export type SmartFinanceItem={
  id:string;
  source:'recurring'|'history';
  label:string;
  category:string;
  date:string;
  amount:number;
  confidence:'certain'|'probable';
};

export type SmartFinanceIncomeDecision={
  id:string;
  source:'recurring'|'history';
  label:string;
  category:string;
  date:string|null;
  amount:number;
  status:'included'|'excluded';
  reasonCode:
    |'recurring-in-month'
    |'recurring-outside-month'
    |'recurring-invalid'
    |'history-3-of-4'
    |'history-too-few-months'
    |'history-unstable-amount'
    |'history-unstable-date'
    |'history-already-received'
    |'history-covered-by-recurring'
    |'history-date-passed';
  reason:{it:string;en:string};
  evidence:string;
};

export type SmartFinanceForecast={
  projectedBalance:number;
  currentBalance:number;
  scheduledIncome:number;
  scheduledExpense:number;
  historicalIncome:number;
  projectedVariableExpense:number;
  confidence:'high'|'medium'|'low';
  items:SmartFinanceItem[];
  incomeDecisions:SmartFinanceIncomeDecision[];
  formula:string;
};

const iso=/^\d{4}-\d{2}-\d{2}$/;
const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
const median=(values:number[])=>{
  const sorted=[...values].sort((a,b)=>a-b);
  if(!sorted.length)return 0;
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};

export function normalizeFinanceLabel(value:string){
  return value.toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

function categoryKey(value:string){return normalizeFinanceLabel(value)}
function similarAmount(left:number,right:number,tolerance=.2){return Math.abs(left-right)/Math.max(Math.abs(left),Math.abs(right),1)<=tolerance}

function daysInMonth(month:string){
  const [year,number]=month.split('-').map(Number);
  return new Date(Date.UTC(year,number,0)).getUTCDate();
}

function shiftMonth(month:string,offset:number){
  const [year,number]=month.split('-').map(Number);
  const date=new Date(Date.UTC(year,number-1+offset,1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}

function dateForDay(month:string,day:number){
  return `${month}-${String(Math.min(Math.max(1,day),daysInMonth(month))).padStart(2,'0')}`;
}

function recurringAmount(rule:SmartFinanceRecurring){
  const value=Number(rule.amount);
  if(!Number.isFinite(value))return Number.NaN;
  if(rule.categoryKind==='income')return Math.abs(value);
  if(rule.categoryKind==='expense')return -Math.abs(value);
  return value;
}

function occurrences(rule:SmartFinanceRecurring,start:string,endExclusive:string){
  const dates:string[]=[];
  let cursor=rule.next_run;
  let guard=0;
  while(cursor<start&&guard++<120)cursor=addRecurringDate(cursor,rule.frequency,rule.interval_count);
  while(cursor<endExclusive&&guard++<180){
    dates.push(cursor);
    const next=addRecurringDate(cursor,rule.frequency,rule.interval_count);
    if(next<=cursor)break;
    cursor=next;
  }
  return dates;
}

type HistoricalCandidate={row:SmartFinanceTransaction;amount:number;month:string;day:number};

function bestMonthlySeries(rows:HistoricalCandidate[]){
  const seeds=rows.map(row=>row.amount);
  let best:HistoricalCandidate[]=[];
  let bestSpread=Number.POSITIVE_INFINITY;
  for(const seed of seeds){
    const byMonth=new Map<string,HistoricalCandidate[]>();
    for(const row of rows.filter(item=>similarAmount(item.amount,seed))){
      const list=byMonth.get(row.month)||[];list.push(row);byMonth.set(row.month,list);
    }
    const selected=[...byMonth.values()].map(list=>list.sort((a,b)=>Math.abs(a.amount-seed)-Math.abs(b.amount-seed))[0]);
    const typical=median(selected.map(row=>row.amount));
    const spread=selected.length?(Math.max(...selected.map(row=>row.amount))-Math.min(...selected.map(row=>row.amount)))/Math.max(typical,1):Number.POSITIVE_INFINITY;
    if(selected.length>best.length||(selected.length===best.length&&spread<bestSpread)){best=selected;bestSpread=spread}
  }
  return {rows:best.sort((a,b)=>a.row.date.localeCompare(b.row.date)),spread:bestSpread};
}

function historicalIncomeItems(args:{month:string;today:string;history:SmartFinanceTransaction[];current:SmartFinanceTransaction[];scheduled:SmartFinanceItem[]}){
  const allowedMonths=new Set([-1,-2,-3,-4].map(offset=>shiftMonth(args.month,offset)));
  const groups=new Map<string,HistoricalCandidate[]>();
  for(const row of args.history){
    const amount=Number(row.amount);
    if(amount<=0||!Number.isFinite(amount)||!iso.test(row.date)||!allowedMonths.has(row.date.slice(0,7)))continue;
    const key=categoryKey(row.category_name);if(!key)continue;
    const list=groups.get(key)||[];
    list.push({row,amount,month:row.date.slice(0,7),day:Number(row.date.slice(8,10))});
    groups.set(key,list);
  }

  const items:SmartFinanceItem[]=[];
  const decisions:SmartFinanceIncomeDecision[]=[];
  for(const [key,candidates] of groups){
    const sample=candidates.at(-1)!.row;
    const label=sample.note?.trim()||sample.category_name;
    const category=sample.category_name;
    const series=bestMonthlySeries(candidates);
    const months=series.rows.length;
    const typical=round(median(series.rows.map(row=>row.amount)));
    const base={id:`history:${key}`,source:'history' as const,label,category,amount:typical};
    const allMonths=new Set(candidates.map(row=>row.month)).size;

    if(months<3){
      const unstable=allMonths>=3;
      decisions.push({...base,date:null,status:'excluded',reasonCode:unstable?'history-unstable-amount':'history-too-few-months',reason:unstable?{it:'Esclusa: gli importi non formano un pattern stabile.',en:'Excluded: the amounts do not form a stable pattern.'}:{it:'Esclusa: presente in meno di 3 degli ultimi 4 mesi.',en:'Excluded: found in fewer than 3 of the previous 4 months.'},evidence:`${months}/4 mesi`});
      continue;
    }
    if(series.spread>.2){
      decisions.push({...base,date:null,status:'excluded',reasonCode:'history-unstable-amount',reason:{it:'Esclusa: variazione degli importi superiore al 20%.',en:'Excluded: amount variation is greater than 20%.'},evidence:`${months}/4 mesi`});
      continue;
    }

    const days=series.rows.map(row=>row.day);
    const monthEndPattern=median(days)>=24;
    const timingValues=monthEndPattern?series.rows.map(row=>daysInMonth(row.month)-row.day):days;
    if(Math.max(...timingValues)-Math.min(...timingValues)>7){
      decisions.push({...base,date:null,status:'excluded',reasonCode:'history-unstable-date',reason:{it:'Esclusa: giorno di accredito non sufficientemente stabile.',en:'Excluded: the credit date is not stable enough.'},evidence:`${months}/4 mesi`});
      continue;
    }

    const expectedDay=monthEndPattern?daysInMonth(args.month)-Math.round(median(timingValues)):Math.round(median(days));
    const expected=dateForDay(args.month,expectedDay);
    const alreadyReceived=args.current.some(row=>Number(row.amount)>0&&categoryKey(row.category_name)===key&&similarAmount(Number(row.amount),typical));
    if(alreadyReceived){
      decisions.push({...base,date:expected,status:'excluded',reasonCode:'history-already-received',reason:{it:'Esclusa: entrata equivalente già registrata nel mese.',en:'Excluded: an equivalent income is already recorded this month.'},evidence:`${months}/4 mesi · importo tipico ${typical.toFixed(2)}`});
      continue;
    }
    const covered=args.scheduled.some(item=>item.amount>0&&categoryKey(item.category)===key&&similarAmount(item.amount,typical));
    if(covered){
      decisions.push({...base,date:expected,status:'excluded',reasonCode:'history-covered-by-recurring',reason:{it:'Esclusa dallo storico: già conteggiata come ricorrenza Entrata.',en:'Excluded from history: already counted as a recurring income.'},evidence:`${months}/4 mesi · nessun doppio conteggio`});
      continue;
    }
    if(expected<args.today){
      decisions.push({...base,date:expected,status:'excluded',reasonCode:'history-date-passed',reason:{it:'Esclusa: la data abituale del mese è già trascorsa.',en:'Excluded: the usual date for this month has already passed.'},evidence:`${months}/4 mesi`});
      continue;
    }

    const item:SmartFinanceItem={...base,date:expected,source:'history',confidence:'probable'};
    items.push(item);
    decisions.push({...base,date:expected,status:'included',reasonCode:'history-3-of-4',reason:{it:'Inclusa: riconosciuta in almeno 3 degli ultimi 4 mesi con importo e data stabili.',en:'Included: found in at least 3 of the previous 4 months with stable amount and date.'},evidence:`${months}/4 mesi · importo tipico ${typical.toFixed(2)}`});
  }
  return {items,decisions};
}

function projectedVariableExpense(current:SmartFinanceTransaction[],history:SmartFinanceTransaction[],today:string,month:string){
  const elapsed=Math.max(1,Number(today.slice(8,10)));
  const remaining=Math.max(0,daysInMonth(month)-elapsed);
  const currentVariable=-current.filter(row=>Number(row.amount)<0&&row.source!=='recurring').reduce((sum,row)=>sum+Number(row.amount),0);
  const currentDaily=currentVariable/elapsed;
  const byMonth=new Map<string,number>();
  for(const row of history){
    if(Number(row.amount)>=0||row.source==='recurring')continue;
    const key=row.date.slice(0,7);byMonth.set(key,(byMonth.get(key)||0)-Number(row.amount));
  }
  const historicalDaily=[...byMonth].map(([historicalMonth,total])=>total/daysInMonth(historicalMonth));
  const historyDaily=historicalDaily.length?median(historicalDaily):currentDaily;
  const blended=historicalDaily.length?currentDaily*.6+historyDaily*.4:currentDaily;
  return round(Math.max(0,blended*remaining));
}

export function buildSmartFinanceForecast(args:{
  month:string;
  today:string;
  current:SmartFinanceTransaction[];
  history:SmartFinanceTransaction[];
  recurring:SmartFinanceRecurring[];
}):SmartFinanceForecast{
  const start=`${args.month}-01`;
  const [year,monthNumber]=args.month.split('-').map(Number);
  const endExclusive=new Date(Date.UTC(year,monthNumber,1)).toISOString().slice(0,10);
  const currentIncome=args.current.filter(row=>Number(row.amount)>0).reduce((sum,row)=>sum+Number(row.amount),0);
  const currentExpense=-args.current.filter(row=>Number(row.amount)<0).reduce((sum,row)=>sum+Number(row.amount),0);
  const currentBalance=round(currentIncome-currentExpense);
  const scheduled:SmartFinanceItem[]=[];
  const recurringDecisions:SmartFinanceIncomeDecision[]=[];

  for(const rule of args.recurring.filter(item=>item.active!==false)){
    const amount=round(recurringAmount(rule));
    const isIncome=rule.categoryKind==='income'||amount>0;
    const label=rule.note?.trim()||rule.category_name;
    const base={source:'recurring' as const,label,category:rule.category_name,amount:Number.isFinite(amount)?Math.abs(amount):0};
    if(!Number.isFinite(amount)||amount===0||!iso.test(rule.next_run)){
      if(isIncome)recurringDecisions.push({...base,id:`recurring:${rule.id}`,date:iso.test(rule.next_run)?rule.next_run:null,status:'excluded',reasonCode:'recurring-invalid',reason:{it:'Esclusa: importo o data della ricorrenza non validi.',en:'Excluded: invalid recurring amount or date.'},evidence:'ricorrenza Entrata'});
      continue;
    }
    let dates:string[]=[];
    try{dates=occurrences(rule,start,endExclusive)}catch{
      if(isIncome)recurringDecisions.push({...base,id:`recurring:${rule.id}`,date:rule.next_run,status:'excluded',reasonCode:'recurring-invalid',reason:{it:'Esclusa: frequenza o data della ricorrenza non valide.',en:'Excluded: invalid recurring frequency or date.'},evidence:'ricorrenza Entrata'});
      continue;
    }
    const futureDates=dates.filter(date=>date>=args.today);
    for(const date of futureDates){
      scheduled.push({id:`recurring:${rule.id}:${date}`,source:'recurring',label,category:rule.category_name,date,amount,confidence:'certain'});
      if(isIncome)recurringDecisions.push({...base,id:`recurring:${rule.id}:${date}`,date,amount,status:'included',reasonCode:'recurring-in-month',reason:{it:'Inclusa: ricorrenza di tipo Entrata attiva e in scadenza entro fine mese.',en:'Included: active income recurrence due before month end.'},evidence:'ricorrenza certa'});
    }
    if(isIncome&&!futureDates.length){
      const pastInMonth=dates.filter(date=>date<args.today).at(-1);
      recurringDecisions.push({...base,id:`recurring:${rule.id}`,date:pastInMonth||rule.next_run,status:'excluded',reasonCode:'recurring-outside-month',reason:{it:pastInMonth?'Esclusa: la scadenza del mese è già trascorsa.':'Esclusa: la prossima scadenza non è nel mese corrente.',en:pastInMonth?'Excluded: this month’s due date has already passed.':'Excluded: the next due date is outside the current month.'},evidence:pastInMonth?'scadenza trascorsa':'fuori mese'});
    }
  }

  const historical=historicalIncomeItems({month:args.month,today:args.today,history:args.history,current:args.current,scheduled});
  const scheduledIncome=round(scheduled.filter(item=>item.amount>0).reduce((sum,item)=>sum+item.amount,0));
  const scheduledExpense=round(-scheduled.filter(item=>item.amount<0).reduce((sum,item)=>sum+item.amount,0));
  const historicalIncome=round(historical.items.reduce((sum,item)=>sum+item.amount,0));
  const variableExpense=projectedVariableExpense(args.current,args.history,args.today,args.month);
  const projectedBalance=round(currentBalance+scheduledIncome+historicalIncome-scheduledExpense-variableExpense);
  const confidence:SmartFinanceForecast['confidence']=scheduledIncome>0?'high':historicalIncome>0?'medium':'low';
  return {
    projectedBalance,currentBalance,scheduledIncome,scheduledExpense,historicalIncome,projectedVariableExpense:variableExpense,confidence,
    items:[...scheduled,...historical.items].sort((a,b)=>a.date.localeCompare(b.date)||b.amount-a.amount),
    incomeDecisions:[...recurringDecisions,...historical.decisions].sort((a,b)=>(a.status===b.status?0:a.status==='included'?-1:1)||(a.date||'9999').localeCompare(b.date||'9999')||a.label.localeCompare(b.label)),
    formula:'saldo attuale + entrate programmate + entrate abituali - uscite programmate - spesa variabile stimata',
  };
}
