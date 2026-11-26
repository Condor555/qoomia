import {addRecurringDate,type RecurrenceFrequency} from './recurrence';
import type {SupabaseClient} from '@supabase/supabase-js';

export const MONTH_PATTERN=/^\d{4}-(0[1-9]|1[0-2])$/;
export const monthStart=(month:string)=>`${month}-01`;
export function nextMonth(month:string){const [year,value]=month.split('-').map(Number);const date=new Date(Date.UTC(year,value,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`}
export function previousMonth(month:string){const [year,value]=month.split('-').map(Number);const date=new Date(Date.UTC(year,value-2,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`}
export function monthLastDay(month:string){const [year,value]=month.split('-').map(Number);return new Date(Date.UTC(year,value,0)).toISOString().slice(0,10)}
export const roundMoney=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export const roundPercent=(value:number)=>Math.round((value+Number.EPSILON)*1000)/1000;

export function macroAllocationMetrics(allocationAmount:number,rolloverAmount:number,discretionarySpent:number,projectedDiscretionary:number){
  const allocatedBudget=roundMoney(allocationAmount+rolloverAmount);const hasAllocation=allocatedBudget>0;
  const percentage=hasAllocation?Math.round(discretionarySpent/allocatedBudget*100):0;
  const status:'ok'|'warning'|'over'=hasAllocation&&discretionarySpent>=allocatedBudget?'over':hasAllocation&&discretionarySpent>=allocatedBudget*.8?'warning':'ok';
  return {hasAllocation,allocatedBudget,percentage,status,available:hasAllocation?roundMoney(allocatedBudget-discretionarySpent):0,projectedPercentage:hasAllocation?Math.round(projectedDiscretionary/allocatedBudget*100):0};
}

function romeToday(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const value=(type:string)=>Number(parts.find(part=>part.type===type)?.value||0);
  return {year:value('year'),month:value('month'),day:value('day')};
}

export function monthPace(month:string){
  const [year,monthNumber]=month.split('-').map(Number);const today=romeToday();
  const selectedKey=year*12+monthNumber;const currentKey=today.year*12+today.month;
  const daysInMonth=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
  const daysConsidered=selectedKey<currentKey?daysInMonth:selectedKey===currentKey?Math.min(today.day,daysInMonth):0;
  return {daysInMonth,daysConsidered,isPast:selectedKey<currentKey,isCurrent:selectedKey===currentKey,isFuture:selectedKey>currentKey};
}

function occurrencesInMonth(start:string,frequency:RecurrenceFrequency,interval:number,month:string){
  const from=monthStart(month),through=monthLastDay(month);let cursor=start;let guard=0;
  while(cursor<from&&guard<600){cursor=addRecurringDate(cursor,frequency,interval);guard++}
  const dates:string[]=[];
  while(cursor<=through&&dates.length<64){dates.push(cursor);const next=addRecurringDate(cursor,frequency,interval);if(next<=cursor)break;cursor=next}
  return dates;
}

export type MacroBudgetCategoryAnalysis={name:string;icon?:string|null;color?:string|null;spent:number;discretionarySpent:number;fixedSpent:number};
export type MacroBudgetAnalysis={
  id:string;name:string;color:string;sortOrder:number;rolloverEnabled:boolean;
  allocationPercent:number;allocationAmount:number;rolloverAmount:number;commitments:number;
  hasAllocation:boolean;allocatedBudget:number;budget:number;spent:number;discretionarySpent:number;fixedSpent:number;available:number;percentage:number;status:'ok'|'warning'|'over';projected:number;projectedDiscretionary:number;projectedPercentage:number;
  categories:MacroBudgetCategoryAnalysis[];
};

export type MacroBudgetSnapshot={
  month:string;spaceId:string;hasBudgetPlan:boolean;totalBudget:number;totalSpent:number;totalPercentage:number;totalAvailable:number;
  commitments:number;distributable:number;allocated:number;unallocated:number;overcommitted:number;
  discretionarySpent:number;fixedSpent:number;projectedExpense:number;projectedOverage:number;daysInMonth:number;daysConsidered:number;
  macros:MacroBudgetAnalysis[];
};

type BudgetRow={category_name:string|null;amount:number|string};
type MacroRow={id:string;name:string;color:string;sort_order:number|string;rollover_enabled:boolean};
type CategoryRow={name:string;icon:string|null;color:string|null;kind:'expense'|'income';macro_category_id:string|null};
type AllocationRow={macro_category_id:string;allocation_percent:number|string;base_amount:number|string;rollover_amount:number|string};
type BudgetTransactionRow={amount:number|string;category_name:string;recurring_id:string|null;date:string};
type RecurringBudgetRow={id:string;amount:number|string;category_name:string;frequency:RecurrenceFrequency;interval_count:number|string;next_run:string;active:boolean};

/**
 * The statistics endpoint already needs these four datasets. Accepting them here
 * prevents the budget calculation from issuing the same Supabase queries again.
 * Other callers can keep omitting this argument and retain the previous behaviour.
 */
export type MacroBudgetPreloaded={
  categories:CategoryRow[];
  rows:BudgetTransactionRow[];
  previousRows:BudgetTransactionRow[];
  recurring:RecurringBudgetRow[];
};

export async function loadMacroBudgetSnapshot(sb:SupabaseClient,spaceId:string,month:string,preloaded?:MacroBudgetPreloaded|Promise<MacroBudgetPreloaded>):Promise<MacroBudgetSnapshot>{
  const previous=previousMonth(month);const start=monthStart(month),end=monthStart(nextMonth(month));const previousStart=monthStart(previous);
  const shared=preloaded?Promise.resolve(preloaded):Promise.all([
    sb.from('categories').select('name,icon,color,kind,macro_category_id').eq('space_id',spaceId).eq('kind','expense').order('name'),
    sb.from('transactions').select('amount,category_name,recurring_id,date').eq('space_id',spaceId).gte('date',start).lt('date',end),
    sb.from('transactions').select('amount,category_name,recurring_id,date').eq('space_id',spaceId).gte('date',previousStart).lt('date',start),
    sb.from('recurring_transactions').select('id,amount,category_name,frequency,interval_count,next_run,active').eq('space_id',spaceId).eq('active',true),
  ]).then(([categoryResult,rowResult,previousRowResult,recurringResult])=>{
    const error=categoryResult.error||rowResult.error||previousRowResult.error||recurringResult.error;
    if(error)throw new Error(error.message);
    return {
      categories:(categoryResult.data||[]) as unknown as CategoryRow[],
      rows:(rowResult.data||[]) as unknown as BudgetTransactionRow[],
      previousRows:(previousRowResult.data||[]) as unknown as BudgetTransactionRow[],
      recurring:(recurringResult.data||[]) as unknown as RecurringBudgetRow[],
    };
  });
  const [{data:budgetRows,error:budgetError},{data:macros,error:macroError},{data:allocations,error:allocationError},{data:previousAllocations,error:previousAllocationError},sharedRows]=await Promise.all([
    sb.from('budgets').select('category_name,amount').eq('space_id',spaceId).eq('month',start),
    sb.from('budget_macro_categories').select('id,name,color,sort_order,rollover_enabled').eq('space_id',spaceId).order('sort_order').order('name'),
    sb.from('macro_budget_allocations').select('macro_category_id,allocation_percent,base_amount,rollover_amount').eq('space_id',spaceId).eq('month',start),
    sb.from('macro_budget_allocations').select('macro_category_id,allocation_percent,base_amount,rollover_amount').eq('space_id',spaceId).eq('month',previousStart),
    shared,
  ]);
  const error=budgetError||macroError||allocationError||previousAllocationError;
  if(error)throw new Error(error.message);

  const macroList=(macros||[]) as unknown as MacroRow[];
  const categoryList=sharedRows.categories.filter(category=>category.kind==='expense');
  const transactionRows=sharedRows.rows;
  const budgetList=(budgetRows||[]) as unknown as BudgetRow[];
  const allocationList=(allocations||[]) as unknown as AllocationRow[];
  const previousAllocationList=(previousAllocations||[]) as unknown as AllocationRow[];
  const previousTransactionRows=sharedRows.previousRows;
  const recurringRows=sharedRows.recurring;
  const otherId=macroList.find(item=>item.name==='Altro')?.id||macroList[0]?.id||null;
  const categoryMacro=new Map<string,string|null>(categoryList.map(item=>[item.name,item.macro_category_id||otherId]));
  const macroFor=(categoryName:string)=>categoryMacro.get(categoryName)||otherId;
  const totalBudgetRow=budgetList.find(row=>row.category_name===null);const hasBudgetPlan=Boolean(totalBudgetRow);const totalBudget=Number(totalBudgetRow?.amount||0);
  const paidOccurrences=new Set(transactionRows.filter(row=>row.recurring_id).map(row=>`${row.recurring_id}:${row.date}`));
  const commitmentsByMacro=new Map<string,number>();
  const fixedSpentByMacro=new Map<string,number>();
  const discretionarySpentByMacro=new Map<string,number>();
  const categorySpent=new Map<string,{spent:number;fixed:number;discretionary:number}>();
  let totalSpent=0,fixedSpent=0,discretionarySpent=0;

  for(const row of transactionRows){
    const amount=Number(row.amount);if(amount>=0)continue;
    const value=-amount;const macroId=macroFor(row.category_name);totalSpent+=value;
    const category=categorySpent.get(row.category_name)||{spent:0,fixed:0,discretionary:0};category.spent+=value;
    if(row.recurring_id){fixedSpent+=value;category.fixed+=value;if(macroId)fixedSpentByMacro.set(macroId,(fixedSpentByMacro.get(macroId)||0)+value)}
    else{discretionarySpent+=value;category.discretionary+=value;if(macroId)discretionarySpentByMacro.set(macroId,(discretionarySpentByMacro.get(macroId)||0)+value)}
    categorySpent.set(row.category_name,category);
  }
  for(const [macroId,value] of fixedSpentByMacro)commitmentsByMacro.set(macroId,value);
  for(const rule of recurringRows){
    if(Number(rule.amount)>=0)continue;
    const macroId=macroFor(rule.category_name);if(!macroId)continue;
    const dates=occurrencesInMonth(rule.next_run,rule.frequency as RecurrenceFrequency,Number(rule.interval_count||1),month);
    for(const dueDate of dates){
      if(paidOccurrences.has(`${rule.id}:${dueDate}`))continue;
      commitmentsByMacro.set(macroId,(commitmentsByMacro.get(macroId)||0)+Math.abs(Number(rule.amount)));
    }
  }
  const commitments=roundMoney([...commitmentsByMacro.values()].reduce((sum,value)=>sum+value,0));
  const distributable=roundMoney(Math.max(0,totalBudget-commitments));
  const overcommitted=roundMoney(Math.max(0,commitments-totalBudget));
  const allocationMap=new Map<string,AllocationRow>(allocationList.map(row=>[row.macro_category_id,row]));
  const previousAllocationMap=new Map<string,AllocationRow>(previousAllocationList.map(row=>[row.macro_category_id,row]));
  const previousDiscretionary=new Map<string,number>();
  for(const row of previousTransactionRows){if(Number(row.amount)>=0||row.recurring_id)continue;const macroId=macroFor(row.category_name);if(macroId)previousDiscretionary.set(macroId,(previousDiscretionary.get(macroId)||0)-Number(row.amount))}
  const pace=monthPace(month);

  const macroAnalysis:MacroBudgetAnalysis[]=macroList.map(macro=>{
    const allocation=allocationMap.get(macro.id);const previousAllocation=previousAllocationMap.get(macro.id);
    const allocationPercent=Number(allocation?.allocation_percent||0);
    const allocationAmount=roundMoney(distributable*allocationPercent/100);
    const rolloverAmount=macro.rollover_enabled&&previousAllocation
      ?roundMoney(Math.max(0,Number(previousAllocation.base_amount||0)+Number(previousAllocation.rollover_amount||0)-(previousDiscretionary.get(macro.id)||0)))
      :0;
    const macroCommitments=roundMoney(commitmentsByMacro.get(macro.id)||0);
    const macroDiscretionary=roundMoney(discretionarySpentByMacro.get(macro.id)||0);
    const macroFixed=roundMoney(fixedSpentByMacro.get(macro.id)||0);
    const spent=roundMoney(macroDiscretionary+macroFixed);
    // Gli impegni restano una voce separata: non diventano il budget della macro.
    // Il budget allocato finanzia la sola quota discrezionale (più l'eventuale rollover).
    const projectedDiscretionary=pace.isPast?macroDiscretionary:pace.isCurrent&&pace.daysConsidered>0?macroDiscretionary/pace.daysConsidered*pace.daysInMonth:0;
    const projected=roundMoney(projectedDiscretionary+macroCommitments);
    const metrics=macroAllocationMetrics(allocationAmount,rolloverAmount,macroDiscretionary,projectedDiscretionary);
    const macroCategories=categoryList.filter(category=>(category.macro_category_id||otherId)===macro.id).map(category=>{const values=categorySpent.get(category.name)||{spent:0,fixed:0,discretionary:0};return {name:category.name,icon:category.icon,color:category.color,spent:roundMoney(values.spent),fixedSpent:roundMoney(values.fixed),discretionarySpent:roundMoney(values.discretionary)}}).sort((a,b)=>b.spent-a.spent||a.name.localeCompare(b.name,'it'));
    return {id:macro.id,name:macro.name,color:macro.color,sortOrder:Number(macro.sort_order),rolloverEnabled:Boolean(macro.rollover_enabled),allocationPercent,allocationAmount,rolloverAmount,commitments:macroCommitments,hasAllocation:metrics.hasAllocation,allocatedBudget:metrics.allocatedBudget,budget:metrics.allocatedBudget,spent,discretionarySpent:macroDiscretionary,fixedSpent:macroFixed,available:metrics.available,percentage:metrics.percentage,status:metrics.status,projected,projectedDiscretionary:roundMoney(projectedDiscretionary),projectedPercentage:metrics.projectedPercentage,categories:macroCategories};
  });
  const allocated=roundMoney(macroAnalysis.reduce((sum,item)=>sum+item.allocationAmount,0));
  const projectedExpense=roundMoney(macroAnalysis.reduce((sum,item)=>sum+item.projected,0));
  return {month,spaceId,hasBudgetPlan,totalBudget,totalSpent:roundMoney(totalSpent),totalPercentage:totalBudget>0?Math.round(totalSpent/totalBudget*100):0,totalAvailable:roundMoney(totalBudget-totalSpent),commitments,distributable,allocated,unallocated:roundMoney(Math.max(0,distributable-allocated)),overcommitted,discretionarySpent:roundMoney(discretionarySpent),fixedSpent:roundMoney(fixedSpent),projectedExpense,projectedOverage:totalBudget>0?roundMoney(Math.max(0,projectedExpense-totalBudget)):0,daysInMonth:pace.daysInMonth,daysConsidered:pace.daysConsidered,macros:macroAnalysis};
}
