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

export type SmartFinanceForecast={
  projectedBalance:number;
  currentBalance:number;
  scheduledIncome:number;
  scheduledExpense:number;
  historicalIncome:number;
  projectedVariableExpense:number;
  confidence:'high'|'medium'|'low';
  items:SmartFinanceItem[];
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

function keyOf(row:{note?:string|null;category_name:string}){
  return `${normalizeFinanceLabel(row.note||row.category_name)}|${normalizeFinanceLabel(row.category_name)}`;
}

function daysInMonth(month:string){
  const [year,number]=month.split('-').map(Number);
  return new Date(Date.UTC(year,number,0)).getUTCDate();
}

function dateForDay(month:string,day:number){
  return `${month}-${String(Math.min(Math.max(1,day),daysInMonth(month))).padStart(2,'0')}`;
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

function historicalIncomeItems(args:{month:string;today:string;history:SmartFinanceTransaction[];current:SmartFinanceTransaction[];scheduled:SmartFinanceItem[]}){
  const groups=new Map<string,SmartFinanceTransaction[]>();
  for(const row of args.history){
    if(Number(row.amount)<=0||!iso.test(row.date))continue;
    const key=keyOf(row);const list=groups.get(key)||[];list.push(row);groups.set(key,list);
  }
  const currentKeys=new Set(args.current.filter(row=>Number(row.amount)>0).map(keyOf));
  const scheduledKeys=new Set(args.scheduled.filter(item=>item.amount>0).map(item=>`${normalizeFinanceLabel(item.label)}|${normalizeFinanceLabel(item.category)}`));
  const items:SmartFinanceItem[]=[];
  for(const [key,rows] of groups){
    const months=[...new Set(rows.map(row=>row.date.slice(0,7)))];
    if(months.length<3||currentKeys.has(key)||scheduledKeys.has(key))continue;
    const amounts=rows.map(row=>Number(row.amount)).filter(Number.isFinite);
    const typical=median(amounts);if(typical<=0)continue;
    const spread=(Math.max(...amounts)-Math.min(...amounts))/typical;
    const days=rows.map(row=>Number(row.date.slice(8,10)));
    if(spread>.2||Math.max(...days)-Math.min(...days)>6)continue;
    const expected=dateForDay(args.month,Math.round(median(days)));
    if(expected<args.today)continue;
    const sample=rows.at(-1)!;
    items.push({id:`history:${key}`,source:'history',label:sample.note?.trim()||sample.category_name,category:sample.category_name,date:expected,amount:round(typical),confidence:'probable'});
  }
  return items;
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
  for(const rule of args.recurring.filter(item=>item.active!==false)){
    for(const date of occurrences(rule,start,endExclusive)){
      if(date<args.today)continue;
      const amount=round(Number(rule.amount));
      scheduled.push({id:`recurring:${rule.id}:${date}`,source:'recurring',label:rule.note?.trim()||rule.category_name,category:rule.category_name,date,amount,confidence:'certain'});
    }
  }
  const inferred=historicalIncomeItems({month:args.month,today:args.today,history:args.history,current:args.current,scheduled});
  const scheduledIncome=round(scheduled.filter(item=>item.amount>0).reduce((sum,item)=>sum+item.amount,0));
  const scheduledExpense=round(-scheduled.filter(item=>item.amount<0).reduce((sum,item)=>sum+item.amount,0));
  const historicalIncome=round(inferred.reduce((sum,item)=>sum+item.amount,0));
  const variableExpense=projectedVariableExpense(args.current,args.history,args.today,args.month);
  const projectedBalance=round(currentBalance+scheduledIncome+historicalIncome-scheduledExpense-variableExpense);
  const confidence:SmartFinanceForecast['confidence']=scheduledIncome>0?'high':historicalIncome>0?'medium':'low';
  return {
    projectedBalance,currentBalance,scheduledIncome,scheduledExpense,historicalIncome,projectedVariableExpense:variableExpense,confidence,
    items:[...scheduled,...inferred].sort((a,b)=>a.date.localeCompare(b.date)||b.amount-a.amount),
    formula:'saldo attuale + entrate programmate + entrate abituali - uscite programmate - spesa variabile stimata',
  };
}
