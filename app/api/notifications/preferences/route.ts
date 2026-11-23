import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '../../../../lib/supabase/server';

const Threshold=z.union([z.literal(80),z.literal(90),z.literal(100)]);
const Preferences=z.object({enabled:z.boolean(),budgetEnabled:z.boolean(),budgetThresholds:z.array(Threshold).min(1).max(3),goalsEnabled:z.boolean(),goalThresholds:z.array(Threshold).min(1).max(3)});
const defaults={enabled:false,budgetEnabled:true,budgetThresholds:[80,90,100],goalsEnabled:true,goalThresholds:[80,90,100]};
const clean=(values:number[])=>[...new Set(values)].filter(value=>value===80||value===90||value===100).sort((a,b)=>a-b);

export async function GET(){
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data,error}=await sb.from('notification_preferences').select('enabled,budget_enabled,budget_thresholds,goals_enabled,goal_thresholds').eq('user_id',user.id).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({data:data?{enabled:Boolean(data.enabled),budgetEnabled:Boolean(data.budget_enabled),budgetThresholds:clean(data.budget_thresholds||defaults.budgetThresholds),goalsEnabled:Boolean(data.goals_enabled),goalThresholds:clean(data.goal_thresholds||defaults.goalThresholds)}:defaults,vapidPublicKey:process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||''});
}

export async function PATCH(req:Request){
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const parsed=Preferences.safeParse(await req.json());
  if(!parsed.success)return NextResponse.json({error:'Preferenze notifiche non valide.'},{status:400});
  const value=parsed.data;
  const row={user_id:user.id,enabled:value.enabled,budget_enabled:value.budgetEnabled,budget_thresholds:clean(value.budgetThresholds),goals_enabled:value.goalsEnabled,goal_thresholds:clean(value.goalThresholds),updated_at:new Date().toISOString()};
  const {error}=await sb.from('notification_preferences').upsert(row,{onConflict:'user_id'});
  return NextResponse.json({data:value,error:error?.message},{status:error?400:200});
}
