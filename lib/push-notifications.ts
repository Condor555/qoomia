import {createClient as createAdminClient,type SupabaseClient} from '@supabase/supabase-js';
import {loadMacroBudgetSnapshot} from './macro-budget';
import {sendWebPush} from './web-push';

export type NotificationKind='budget'|'goal';
type PreferenceRow={user_id:string;enabled:boolean;budget_enabled:boolean;budget_thresholds:number[];goals_enabled:boolean;goal_thresholds:number[]};
type SubscriptionRow={id:string;user_id:string;endpoint:string;p256dh:string;auth:string};
type Locale='it'|'en';

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return null;
  return createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function monthInRome(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const value=(type:string)=>parts.find(part=>part.type===type)?.value||'';
  return `${value('year')}-${value('month')}`;
}
function thresholdList(value:unknown){const selected=(Array.isArray(value)?value:[]).map(Number).find(item=>item===50||item===60||item===70||item===80||item===90||item===100);return [selected||80]}
function text(locale:Locale,it:string,en:string){return locale==='en'?en:it}

async function claimDelivery(sb:SupabaseClient,row:{user_id:string;space_id:string;kind:NotificationKind;subject_id:string;period_key:string;threshold:number;payload:Record<string,unknown>}){
  const {data,error}=await sb.from('notification_deliveries').insert({...row,status:'pending'}).select('id').maybeSingle();
  if(error?.code==='23505')return null;
  if(error)throw error;
  return data?.id as string|undefined;
}
async function deliver(sb:SupabaseClient,subscriptions:SubscriptionRow[],deliveryId:string,payload:Record<string,unknown>){
  let sent=0;const errors:string[]=[];
  for(const subscription of subscriptions){
    try{
      const result=await sendWebPush(subscription,payload);
      if(result.ok)sent++;
      else{
        errors.push(`${result.status}:${result.body}`);
        if(result.expired)await sb.from('push_subscriptions').delete().eq('id',subscription.id);
      }
    }catch(error){errors.push(error instanceof Error?error.message:'push-failed')}
  }
  await sb.from('notification_deliveries').update({status:sent?'sent':'failed',sent_at:sent?new Date().toISOString():null,error:errors.length?errors.join(' | ').slice(0,1000):null}).eq('id',deliveryId);
}
async function notifyThreshold(sb:SupabaseClient,args:{preference:PreferenceRow;subscriptions:SubscriptionRow[];locale:Locale;spaceId:string;spaceName:string;kind:NotificationKind;subjectId:string;periodKey:string;progress:number;thresholds:number[];title:string;body:(threshold:number)=>string;url:string}){
  const eligible=thresholdList(args.thresholds).filter(threshold=>args.progress>=threshold);
  const threshold=eligible.at(-1);if(!threshold||!args.subscriptions.length)return;
  const tag=`qoomia:${args.kind}:${args.spaceId}:${args.subjectId}:${args.periodKey}:${threshold}`;
  const payload={title:args.title,body:args.body(threshold),url:args.url,tag,kind:args.kind,threshold,spaceId:args.spaceId};
  const deliveryId=await claimDelivery(sb,{user_id:args.preference.user_id,space_id:args.spaceId,kind:args.kind,subject_id:args.subjectId,period_key:args.periodKey,threshold,payload});
  if(deliveryId)await deliver(sb,args.subscriptions,deliveryId,payload);
}

export async function evaluateSpaceNotifications(spaceId:string,kinds:NotificationKind[]=['budget','goal']){
  const sb=adminClient();
  if(!sb||!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return {skipped:'not-configured'};
  const [{data:members,error:memberError},{data:space,error:spaceError}]=await Promise.all([
    sb.from('space_members').select('user_id').eq('space_id',spaceId),
    sb.from('spaces').select('id,name,type').eq('id',spaceId).single(),
  ]);
  if(memberError||spaceError||!space)throw memberError||spaceError||new Error('Space not found');
  const userIds=[...new Set(((members||[]) as Array<{user_id:string}>).map(item=>item.user_id))];if(!userIds.length)return {sent:0};
  const [{data:preferences,error:preferenceError},{data:subscriptions,error:subscriptionError},{data:profiles}]=await Promise.all([
    sb.from('notification_preferences').select('user_id,enabled,budget_enabled,budget_thresholds,goals_enabled,goal_thresholds').in('user_id',userIds).eq('enabled',true),
    sb.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id',userIds),
    sb.from('profiles').select('user_id,language').in('user_id',userIds),
  ]);
  if(preferenceError||subscriptionError)throw preferenceError||subscriptionError;
  const prefs=(preferences||[]) as PreferenceRow[];const subs=(subscriptions||[]) as SubscriptionRow[];
  const language=new Map(((profiles||[]) as Array<{user_id:string;language:string|null}>).map(item=>[item.user_id,item.language==='en'?'en':'it'] as const));
  const subscriptionsByUser=new Map<string,SubscriptionRow[]>();for(const item of subs){const list=subscriptionsByUser.get(item.user_id)||[];list.push(item);subscriptionsByUser.set(item.user_id,list)}
  const month=monthInRome();const jobs:Promise<void>[]=[];
  if(kinds.includes('budget')){
    const snapshot=await loadMacroBudgetSnapshot(sb,spaceId,month);
    if(snapshot.totalBudget>0){
      const progress=Math.max(0,Math.round(snapshot.totalSpent/snapshot.totalBudget*100));
      for(const preference of prefs.filter(item=>item.budget_enabled)){
        const locale=(language.get(preference.user_id)||'it') as Locale;
        jobs.push(notifyThreshold(sb,{preference,subscriptions:subscriptionsByUser.get(preference.user_id)||[],locale,spaceId,spaceName:space.name,kind:'budget',subjectId:'space-budget',periodKey:month,progress,thresholds:preference.budget_thresholds,title:text(locale,`Budget ${space.name}`,`${space.name} budget`),body:threshold=>text(locale,`Hai raggiunto la soglia del ${threshold}%: speso il ${progress}% del Budget mensile.`,`You reached the ${threshold}% threshold: ${progress}% of the monthly budget has been spent.`),url:'/budget'}));
      }
    }
  }
  if(kinds.includes('goal')){
    const [{data:goals,error:goalError},{data:contributions,error:contributionError}]=await Promise.all([
      sb.from('saving_goals').select('id,name,target_amount,status').eq('space_id',spaceId),
      sb.from('saving_goal_contributions').select('goal_id,amount').eq('space_id',spaceId),
    ]);
    if(goalError||contributionError)throw goalError||contributionError;
    const totals=new Map<string,number>();for(const item of contributions||[])totals.set(item.goal_id,(totals.get(item.goal_id)||0)+Number(item.amount));
    for(const goal of goals||[]){
      const target=Number(goal.target_amount);if(target<=0)continue;
      const progress=Math.max(0,Math.min(100,Math.round((totals.get(goal.id)||0)/target*100)));
      for(const preference of prefs.filter(item=>item.goals_enabled)){
        const locale=(language.get(preference.user_id)||'it') as Locale;
        jobs.push(notifyThreshold(sb,{preference,subscriptions:subscriptionsByUser.get(preference.user_id)||[],locale,spaceId,spaceName:space.name,kind:'goal',subjectId:goal.id,periodKey:'lifetime',progress,thresholds:preference.goal_thresholds,title:progress>=100?text(locale,`Obiettivo raggiunto: ${goal.name}`,`Goal reached: ${goal.name}`):text(locale,`Obiettivo ${goal.name}`,`Goal ${goal.name}`),body:threshold=>text(locale,`Hai raggiunto la soglia del ${threshold}% nello spazio ${space.name}.`,`You reached the ${threshold}% threshold in ${space.name}.`),url:'/obiettivi'}));
      }
    }
  }
  await Promise.all(jobs);return {checked:jobs.length};
}

export async function safeEvaluateSpaceNotifications(spaceId:string,kinds:NotificationKind[]){
  try{return await evaluateSpaceNotifications(spaceId,kinds)}catch(error){console.error('Notification evaluation failed',error);return {error:error instanceof Error?error.message:'notification-failed'}}
}
