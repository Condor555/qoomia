import {NextResponse} from 'next/server';
import {createClient as createAdminClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {addRecurringDate} from '../../../../lib/recurrence';
import {notifyRecurringPosted,safeEvaluateSpaceNotifications} from '../../../../lib/push-notifications';

export const dynamic='force-dynamic';
export const maxDuration=60;

type GeneratedRow={recurring_id:string;transaction_id:string;space_id:string;due_date:string;amount:number|string;note:string;category_name:string;created_by:string};
const todayInRome=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

function admin(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return null;
  return createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function cronAuthorized(req:Request){const secret=process.env.CRON_SECRET;return Boolean(secret&&req.headers.get('authorization')===`Bearer ${secret}`)}

async function afterGenerated(rows:GeneratedRow[]){
  const spaces=[...new Set(rows.map(row=>row.space_id))];
  const notifications=await Promise.allSettled(rows.map(row=>notifyRecurringPosted({recurringId:row.recurring_id,transactionId:row.transaction_id,spaceId:row.space_id,dueDate:row.due_date,amount:Number(row.amount),note:row.note,categoryName:row.category_name})));
  await Promise.all(spaces.map(spaceId=>safeEvaluateSpaceNotifications(spaceId,['budget'])));
  return {notificationFailures:notifications.filter(result=>result.status==='rejected').length};
}

/** Vercel Cron: esegue tutte le regole scadute con privilegi server-side. */
export async function GET(req:Request){
  if(!process.env.CRON_SECRET)return NextResponse.json({error:'CRON_SECRET non configurato.'},{status:503});
  if(!cronAuthorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
  const sb=admin();if(!sb)return NextResponse.json({error:'Supabase service role non configurata.'},{status:503});
  const today=todayInRome();const {data,error}=await sb.rpc('process_due_recurring',{p_today:today});
  if(error)return NextResponse.json({error:error.message,today},{status:500});
  const rows=(data||[]) as GeneratedRow[];const notification=await afterGenerated(rows);
  return NextResponse.json({ok:true,today,generated:rows.length,spaces:[...new Set(rows.map(row=>row.space_id))].length,...notification},{headers:{'cache-control':'no-store'}});
}

/** Catch-up autenticato: aprendo Ricorrenze l'utente recupera subito eventuali scadenze già maturate. */
export async function POST(){
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const today=todayInRome();const {data,error}=await sb.from('recurring_transactions').select('id,space_id,next_run,frequency,interval_count,amount,note,category_name').eq('created_by',user.id).eq('active',true).eq('auto_post',true).lte('next_run',today);
  if(error)return NextResponse.json({error:error.message},{status:400});
  const generated:GeneratedRow[]=[];const failures:string[]=[];
  for(const recurring of data||[]){let due=recurring.next_run,guard=0;while(due<=today&&guard++<120){const {data:result,error:confirmError}=await sb.rpc('confirm_recurring_payment',{p_recurring_id:recurring.id,p_due_date:due});if(confirmError){failures.push(`${recurring.id}: ${confirmError.message}`);break}if(result?.status==='confirmed')generated.push({recurring_id:recurring.id,transaction_id:result.transactionId,space_id:recurring.space_id,due_date:due,amount:recurring.amount,note:recurring.note,category_name:recurring.category_name,created_by:user.id});due=addRecurringDate(due,recurring.frequency,recurring.interval_count)}}
  const notification=await afterGenerated(generated);
  return NextResponse.json({ok:failures.length===0,today,generated:generated.length,failures,...notification},{status:failures.length?207:200,headers:{'cache-control':'no-store'}});
}

