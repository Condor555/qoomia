import {NextResponse} from 'next/server';
import {createClient as createAdminClient,type SupabaseClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {addRecurringDate} from '../../../../lib/recurrence';
import {safeEvaluateSpaceNotifications,safeNotifyRecurringPosted} from '../../../../lib/push-notifications';

export const maxDuration=60;

type RecurringRow={id:string;space_id:string;next_run:string;frequency:'weekly'|'monthly'|'yearly';interval_count:number;note:string;category_name:string;amount:number|string;currency:string};
type RunResult={generated:number;alreadyConfirmed:number;failures:string[];changedSpaces:Set<string>};

function todayInRome(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return null;
  return createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function recurringNotice(row:RecurringRow,dueDate:string){
  return {recurringId:row.id,spaceId:row.space_id,dueDate,note:row.note,categoryName:row.category_name,amount:Number(row.amount),currency:row.currency||'EUR'};
}
async function finishNotifications(result:RunResult){
  for(const spaceId of result.changedSpaces)await safeEvaluateSpaceNotifications(spaceId,['budget']);
}
async function runDue(sb:SupabaseClient,rows:RecurringRow[],rpcName:'confirm_recurring_payment'|'confirm_recurring_payment_for_cron'){
  const today=todayInRome();const result:RunResult={generated:0,alreadyConfirmed:0,failures:[],changedSpaces:new Set<string>()};
  for(const recurring of rows){
    let due=recurring.next_run;let guard=0;
    while(due<=today&&guard++<24){
      const {data:confirmation,error}=await sb.rpc(rpcName,{p_recurring_id:recurring.id,p_due_date:due});
      if(error){result.failures.push(`${recurring.id}: ${error.message}`);break}
      if(confirmation?.status==='confirmed'){
        result.generated++;result.changedSpaces.add(recurring.space_id);
        await safeNotifyRecurringPosted(recurringNotice(recurring,due));
      }else if(confirmation?.status==='already-confirmed')result.alreadyConfirmed++;
      due=addRecurringDate(due,recurring.frequency,recurring.interval_count);
    }
    if(guard>=24&&due<=today)result.failures.push(`${recurring.id}: limite recupero scadenze raggiunto`);
  }
  await finishNotifications(result);return result;
}

// Vercel Cron richiama questa route ogni giorno. CRON_SECRET impedisce esecuzioni esterne.
export async function GET(req:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
  const sb=adminClient();if(!sb)return NextResponse.json({error:'Server configuration incomplete'},{status:503});
  const today=todayInRome();
  const {data,error}=await sb.from('recurring_transactions').select('id,space_id,next_run,frequency,interval_count,note,category_name,amount,currency').eq('active',true).eq('auto_post',true).lte('next_run',today).order('next_run').limit(500);
  if(error)return NextResponse.json({error:error.message},{status:500});
  const result=await runDue(sb,(data||[]) as RecurringRow[],'confirm_recurring_payment_for_cron');
  return NextResponse.json({generated:result.generated,alreadyConfirmed:result.alreadyConfirmed,failures:result.failures,processedRules:data?.length||0,date:today},{status:result.failures.length?207:200});
}

// Mantiene il runner autenticato esistente per recuperi manuali dell'utente.
export async function POST(){
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const today=todayInRome();const {data,error}=await sb.from('recurring_transactions').select('id,space_id,next_run,frequency,interval_count,note,category_name,amount,currency').eq('created_by',user.id).eq('active',true).eq('auto_post',true).lte('next_run',today).order('next_run');
  if(error)return NextResponse.json({error:error.message},{status:400});
  const result=await runDue(sb,(data||[]) as RecurringRow[],'confirm_recurring_payment');
  return NextResponse.json({generated:result.generated,alreadyConfirmed:result.alreadyConfirmed,failures:result.failures},{status:result.failures.length?207:200});
}

