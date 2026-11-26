import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '../../../../lib/supabase/server';

const Threshold=z.union([z.literal(50),z.literal(60),z.literal(70),z.literal(80),z.literal(90),z.literal(100)]);
const Preferences=z.object({enabled:z.boolean(),budgetEnabled:z.boolean(),budgetThresholds:z.array(Threshold).length(1),goalsEnabled:z.boolean(),goalThresholds:z.array(Threshold).length(1),recurringEnabled:z.boolean().default(true)});
const defaults={enabled:false,budgetEnabled:true,budgetThresholds:[80],goalsEnabled:true,goalThresholds:[80],recurringEnabled:true};
const clean=(values:number[])=>{const value=values.find(item=>item===50||item===60||item===70||item===80||item===90||item===100);return [value||80]};

export async function GET(){
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data,error}=await sb.from('notification_preferences').select('enabled,budget_enabled,budget_thresholds,goals_enabled,goal_thresholds,recurring_enabled').eq('user_id',user.id).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({data:data?{enabled:Boolean(data.enabled),budgetEnabled:Boolean(data.budget_enabled),budgetThresholds:clean(data.budget_thresholds||defaults.budgetThresholds),goalsEnabled:Boolean(data.goals_enabled),goalThresholds:clean(data.goal_thresholds||defaults.goalThresholds),recurringEnabled:data.recurring_enabled!==false}:defaults,vapidPublicKey:process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||''});
}

export async function PATCH(req:Request){
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const parsed=Preferences.safeParse(await req.json());
  if(!parsed.success)return NextResponse.json({error:'Preferenze notifiche non valide.'},{status:400});
  const value=parsed.data;
  const row={user_id:user.id,enabled:value.enabled,budget_enabled:value.budgetEnabled,budget_thresholds:clean(value.budgetThresholds),goals_enabled:value.goalsEnabled,goal_thresholds:clean(value.goalThresholds),recurring_enabled:value.recurringEnabled,updated_at:new Date().toISOString()};
  const {error}=await sb.from('notification_preferences').upsert(row,{onConflict:'user_id'});
  return NextResponse.json({data:value,error:error?.message},{status:error?400:200});
}

