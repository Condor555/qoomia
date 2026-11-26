import {NextResponse} from 'next/server';
import {activeSpace} from '../../../lib/active-space';
import {loadMacroBudgetSnapshot,monthPace,roundMoney} from '../../../lib/macro-budget';
import {buildSmartFinanceForecast,type SmartFinanceRecurring,type SmartFinanceTransaction} from '../../../lib/smart-finance';

type StatsTransactionRow={id?:string;amount:number|string;category_name:string;date:string;created_by?:string|null;note?:string|null;source?:string|null;recurring_id?:string|null;created_at?:string};
type ProfileRow={user_id:string;display_name:string|null};
type CategoryMetaRow={name:string;icon:string|null;color:string|null;kind:'expense'|'income';macro_category_id:string|null};

function monthBounds(month:string){
  const [year,monthNumber]=month.split('-').map(Number);const start=`${year}-${String(monthNumber).padStart(2,'0')}-01`;const nextDate=new Date(Date.UTC(year,monthNumber,1));const end=nextDate.toISOString().slice(0,10);const previousDate=new Date(Date.UTC(year,monthNumber-2,1));const previous=`${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth()+1).padStart(2,'0')}`;return {year,monthNumber,start,end,previous};
}
const percentChange=(current:number,previous:number)=>previous>0?Math.round((current-previous)/previous*100):null;
const todayInRome=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function shiftMonth(month:string,offset:number){const [year,number]=month.split('-').map(Number);const date=new Date(Date.UTC(year,number-1+offset,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`}

export async function GET(req:Request){
  try{
    const url=new URL(req.url);const {sb,spaceId}=await activeSpace(url.searchParams.get('spaceId'));const today=todayInRome();const currentMonth=today.slice(0,7);const requested=url.searchParams.get('month')||currentMonth;const month=/^\d{4}-(0[1-9]|1[0-2])$/.test(requested)?requested:currentMonth;const bounds=monthBounds(month);const previousBounds=monthBounds(bounds.previous);const historyStart=`${shiftMonth(month,-4)}-01`;
    // Share the largest datasets with the macro-budget engine. Previously the
    // endpoint queried current transactions, previous transactions, categories
    // and recurring rules twice, and also loaded saving goals that this screen
    // no longer renders.
    // Convert Supabase's thenable query builders to native promises once so
    // both consumers below reuse one HTTP request instead of executing twice.
    const currentPromise=Promise.resolve(sb.from('transactions').select('id,amount,category_name,date,created_by,note,source,recurring_id,created_at').eq('space_id',spaceId).gte('date',bounds.start).lt('date',bounds.end));
    const historyPromise=Promise.resolve(sb.from('transactions').select('amount,category_name,date,note,source,recurring_id').eq('space_id',spaceId).gte('date',historyStart).lt('date',bounds.start).order('date'));
    const categoriesPromise=Promise.resolve(sb.from('categories').select('name,icon,color,kind,macro_category_id').eq('space_id',spaceId));
    const recurringPromise=Promise.resolve(sb.from('recurring_transactions').select('id,note,category_name,amount,next_run,frequency,interval_count,active').eq('space_id',spaceId).eq('active',true));
    const sharedBudgetRows=Promise.all([currentPromise,historyPromise,categoriesPromise,recurringPromise]).then(([currentResult,historyResult,categoryResult,recurringResult])=>{
      const sharedError=currentResult.error||historyResult.error||categoryResult.error||recurringResult.error;
      if(sharedError)throw new Error(sharedError.message);
      const history=(historyResult.data||[]) as unknown as StatsTransactionRow[];
      return {
        rows:(currentResult.data||[]) as unknown as Array<{amount:number|string;category_name:string;recurring_id:string|null;date:string}>,
        previousRows:history.filter(row=>row.date>=previousBounds.start&&row.date<previousBounds.end).map(row=>({amount:row.amount,category_name:row.category_name,recurring_id:row.recurring_id||null,date:row.date})),
        categories:(categoryResult.data||[]) as unknown as CategoryMetaRow[],
        recurring:(recurringResult.data||[]) as unknown as Array<{id:string;amount:number|string;category_name:string;frequency:'weekly'|'monthly'|'yearly';interval_count:number|string;next_run:string;active:boolean}>,
      };
    });
    const macroBudgetPromise=loadMacroBudgetSnapshot(sb,spaceId,month,sharedBudgetRows);
    const recentPromise=sb.from('transactions').select('id,date,category_name,amount,note,created_by').eq('space_id',spaceId).order('date',{ascending:false}).order('created_at',{ascending:false}).limit(5);
    const [{data,error},{data:historyRows,error:historyError},{data:categoryMetaRows,error:categoryError},{data:recurringRows,error:recurringError},macroBudget,{data:recentRows,error:recentError}]=await Promise.all([
      currentPromise,historyPromise,categoriesPromise,recurringPromise,macroBudgetPromise,recentPromise,
    ]);
    if(error||historyError||categoryError||recurringError||recentError)return NextResponse.json({error:error?.message||historyError?.message||categoryError?.message||recurringError?.message||recentError?.message},{status:400});
    const rows=(data||[]) as unknown as StatsTransactionRow[];
    const history=(historyRows||[]) as unknown as StatsTransactionRow[];
    const previous=history.filter(row=>row.date>=previousBounds.start&&row.date<previousBounds.end);
    const income=rows.filter(row=>Number(row.amount)>0).reduce((sum,row)=>sum+Number(row.amount),0);const expense=-rows.filter(row=>Number(row.amount)<0).reduce((sum,row)=>sum+Number(row.amount),0);
    const previousIncome=previous.filter(row=>Number(row.amount)>0).reduce((sum,row)=>sum+Number(row.amount),0);const previousExpense=-previous.filter(row=>Number(row.amount)<0).reduce((sum,row)=>sum+Number(row.amount),0);
    const byCategory=new Map<string,number>();const byIncomeCategory=new Map<string,number>();const byAuthor=new Map<string,number>();
    rows.filter(row=>Number(row.amount)<0).forEach(row=>{byCategory.set(row.category_name,(byCategory.get(row.category_name)||0)-Number(row.amount));const author=row.created_by||'imported';byAuthor.set(author,(byAuthor.get(author)||0)-Number(row.amount))});
    rows.filter(row=>Number(row.amount)>0).forEach(row=>byIncomeCategory.set(row.category_name,(byIncomeCategory.get(row.category_name)||0)+Number(row.amount)));
    const categoryMeta=new Map(((categoryMetaRows||[]) as unknown as CategoryMetaRow[]).map(item=>[item.name,item]));
    const categories=[...byCategory].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,value])=>({name,value,budget:0,budgetPercentage:0,icon:categoryMeta.get(name)?.icon||null,color:categoryMeta.get(name)?.color||null}));
    const incomeSources=[...byIncomeCategory].sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value,percentage:income>0?Math.round(value/income*100):0,icon:categoryMeta.get(name)?.icon||null,color:categoryMeta.get(name)?.color||null}));
    const top=categories[0];const previousTopExpense=top?previous.filter(row=>row.category_name===top.name&&Number(row.amount)<0).reduce((sum,row)=>sum-Number(row.amount),0):0;
    const authorIds=[...new Set([...byAuthor.keys(),...(recentRows||[]).map((row:any)=>row.created_by).filter(Boolean)])].filter(id=>id!=='imported');const {data:profiles}=authorIds.length?await sb.from('profiles').select('user_id,display_name').in('user_id',authorIds):{data:[]};const profileRows=(profiles||[]) as unknown as ProfileRow[];const names=new Map(profileRows.map(profile=>[profile.user_id,profile.display_name]));const authors=[...byAuthor].sort((a,b)=>b[1]-a[1]).map(([userId,value])=>({userId,name:userId==='imported'?'Importato':names.get(userId)||'Utente',value,percentage:expense?Math.round(value/expense*100):0}));
    const pace=monthPace(month);const {daysInMonth,daysConsidered}=pace;const dailyAverageExpense=daysConsidered>0?roundMoney(expense/daysConsidered):0;
    const projectedExpense=pace.isCurrent&&daysConsidered>0?roundMoney(expense/daysConsidered*daysInMonth):null;
    const periodStatus=pace.isPast?'past':pace.isFuture?'future':'current';
    const smartFinance=periodStatus==='current'?buildSmartFinanceForecast({
      month,today,current:rows as SmartFinanceTransaction[],history:(historyRows||[]) as SmartFinanceTransaction[],
      recurring:((recurringRows||[]) as SmartFinanceRecurring[]).map(rule=>({...rule,categoryKind:categoryMeta.get(rule.category_name)?.kind||null})),
    }):null;
    const recentTransactions=(recentRows||[]).map((row:any)=>{const metadata=categoryMeta.get(row.category_name);return {...row,author_name:row.created_by?(names.get(row.created_by)||'Utente'):'Importato',category_icon:metadata?.icon||null,category_color:metadata?.color||null}});
    return NextResponse.json({
      month,periodStatus,income,expense,balance:income-expense,count:rows.length,previousIncome,previousExpense,
      incomeChangePercent:percentChange(income,previousIncome),expenseChangePercent:percentChange(expense,previousExpense),categories,incomeSources,authors,
      dailyAverageExpense,projectedExpense,daysConsidered,daysInMonth,smartFinance,
      budget:{amount:macroBudget.totalBudget,spent:macroBudget.totalSpent,available:macroBudget.totalAvailable,percentage:macroBudget.totalPercentage,status:macroBudget.totalBudget>0&&macroBudget.totalSpent>=macroBudget.totalBudget?'over':macroBudget.totalBudget>0&&macroBudget.totalSpent>=macroBudget.totalBudget*.8?'warning':'ok',commitments:macroBudget.commitments,distributable:macroBudget.distributable,projected:pace.isCurrent?macroBudget.projectedExpense:null,projectedOverage:pace.isCurrent?macroBudget.projectedOverage:0},
      macroCategories:macroBudget.macros.map((item:any)=>({...item,projected:pace.isCurrent?item.projected:null,projectedPercentage:pace.isCurrent?item.projectedPercentage:null})),
      recentTransactions,
      topCategory:top?{name:top.name,value:top.value,percentage:expense>0?Math.round(top.value/expense*100):0,previousValue:previousTopExpense,changePercent:percentChange(top.value,previousTopExpense),comparison:previousTopExpense>0?'available':'no-previous-data',icon:top.icon,color:top.color}:null,
    });
  }catch(error:unknown){const message=error instanceof Error?error.message:'Unauthorized';return NextResponse.json({error:message},{status:message==='Unauthorized'?401:400})}
}

