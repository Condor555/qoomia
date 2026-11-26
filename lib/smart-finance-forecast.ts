import {addRecurringDate,type RecurrenceFrequency} from './recurrence';

const monthStart=(month:string)=>`${month}-01`;
const monthLastDay=(month:string)=>{const [year,value]=month.split('-').map(Number);return new Date(Date.UTC(year,value,0)).toISOString().slice(0,10)};
const roundMoney=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;

export type ForecastTransaction={amount:number|string;date:string;recurring_id?:string|null;recurring_due_date?:string|null};
export type ForecastRecurring={id:string;amount:number|string;frequency:RecurrenceFrequency;interval_count:number|string;next_run:string;active?:boolean};
export type ForecastConfidence='low'|'medium'|'high';
export type MonthEndForecast={
  status:'past'|'current'|'future';
  registeredIncome:number;registeredExpense:number;registeredBalance:number;
  fixedExpense:number;discretionaryExpense:number;projectedDiscretionaryExpense:number;
  futureRecurringIncome:number;futureRecurringExpense:number;futureRecurringCount:number;
  projectedIncome:number;projectedExpense:number;projectedBalance:number;
  daysInMonth:number;daysConsidered:number;remainingDays:number;confidence:ForecastConfidence;
};

function romeToday(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}

function monthTiming(month:string,today:string){
  const [year,monthNumber]=month.split('-').map(Number);const current=today.slice(0,7);
  const daysInMonth=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
  const status:MonthEndForecast['status']=month<current?'past':month>current?'future':'current';
  const daysConsidered=status==='past'?daysInMonth:status==='current'?Math.min(Number(today.slice(8,10)),daysInMonth):0;
  return {status,daysInMonth,daysConsidered,remainingDays:Math.max(0,daysInMonth-daysConsidered)};
}

function occurrencesInMonth(rule:ForecastRecurring,month:string){
  const from=monthStart(month),through=monthLastDay(month);let cursor=rule.next_run;let guard=0;
  while(cursor<from&&guard<600){cursor=addRecurringDate(cursor,rule.frequency,Math.max(1,Number(rule.interval_count)||1));guard++}
  const dates:string[]=[];
  while(cursor<=through&&dates.length<64){dates.push(cursor);const next=addRecurringDate(cursor,rule.frequency,Math.max(1,Number(rule.interval_count)||1));if(next<=cursor)break;cursor=next}
  return dates;
}

export function buildMonthEndForecast({month,transactions,recurring,today=romeToday()}:{month:string;transactions:ForecastTransaction[];recurring:ForecastRecurring[];today?:string}):MonthEndForecast{
  const timing=monthTiming(month,today);
  const registeredIncome=roundMoney(transactions.filter(row=>Number(row.amount)>0).reduce((sum,row)=>sum+Number(row.amount),0));
  const registeredExpense=roundMoney(-transactions.filter(row=>Number(row.amount)<0).reduce((sum,row)=>sum+Number(row.amount),0));
  const fixedExpense=roundMoney(-transactions.filter(row=>Number(row.amount)<0&&Boolean(row.recurring_id)).reduce((sum,row)=>sum+Number(row.amount),0));
  const discretionaryExpense=roundMoney(Math.max(0,registeredExpense-fixedExpense));
  const paidOccurrences=new Set(transactions.filter(row=>row.recurring_id).map(row=>`${row.recurring_id}:${row.recurring_due_date||row.date}`));
  let futureRecurringIncome=0,futureRecurringExpense=0,futureRecurringCount=0;

  if(timing.status!=='past')for(const rule of recurring.filter(item=>item.active!==false)){
    for(const dueDate of occurrencesInMonth(rule,month)){
      if(paidOccurrences.has(`${rule.id}:${dueDate}`))continue;
      // In the current month, an unconfirmed overdue item remains an expected commitment.
      const amount=Number(rule.amount);if(!Number.isFinite(amount)||amount===0)continue;
      if(amount>0)futureRecurringIncome+=amount;else futureRecurringExpense+=Math.abs(amount);
      futureRecurringCount++;
    }
  }

  const pacedDiscretionary=timing.status==='current'&&timing.daysConsidered>0
    ?discretionaryExpense/timing.daysConsidered*timing.daysInMonth
    :timing.status==='past'?discretionaryExpense:0;
  const projectedDiscretionaryExpense=roundMoney(Math.max(discretionaryExpense,pacedDiscretionary));
  const projectedIncome=roundMoney(timing.status==='past'?registeredIncome:registeredIncome+futureRecurringIncome);
  const projectedExpense=roundMoney(timing.status==='past'?registeredExpense:fixedExpense+projectedDiscretionaryExpense+futureRecurringExpense);
  const confidence:ForecastConfidence=timing.status!=='current'||timing.daysConsidered>=16&&transactions.length>=8?'high':timing.daysConsidered>=7&&transactions.length>=3?'medium':'low';
  return {
    ...timing,registeredIncome,registeredExpense,registeredBalance:roundMoney(registeredIncome-registeredExpense),
    fixedExpense,discretionaryExpense,projectedDiscretionaryExpense,
    futureRecurringIncome:roundMoney(futureRecurringIncome),futureRecurringExpense:roundMoney(futureRecurringExpense),futureRecurringCount,
    projectedIncome,projectedExpense,projectedBalance:roundMoney(projectedIncome-projectedExpense),confidence,
  };
}