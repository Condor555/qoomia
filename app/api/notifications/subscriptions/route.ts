import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient as createAdminClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';

const Endpoint=z.string().url().max(2048).refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!/^localhost$|^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./i.test(url.hostname)},{message:'Endpoint push non valido.'});
const Subscription=z.object({endpoint:Endpoint,expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().min(20).max(512),auth:z.string().min(8).max(256)})});
function admin(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}

export async function POST(req:Request){
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const service=admin();if(!service)return NextResponse.json({error:'Push non configurato sul server.'},{status:503});
  const parsed=Subscription.safeParse(await req.json());
  if(!parsed.success)return NextResponse.json({error:'Sottoscrizione push non valida.'},{status:400});
  const value=parsed.data;
  const {error}=await service.from('push_subscriptions').upsert({user_id:user.id,endpoint:value.endpoint,p256dh:value.keys.p256dh,auth:value.keys.auth,user_agent:req.headers.get('user-agent')||'',updated_at:new Date().toISOString()},{onConflict:'endpoint'});
  return NextResponse.json({ok:!error,error:error?.message},{status:error?400:200});
}

export async function DELETE(req:Request){
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const service=admin();if(!service)return NextResponse.json({error:'Push non configurato sul server.'},{status:503});
  const endpoint=Endpoint.safeParse(new URL(req.url).searchParams.get('endpoint'));
  if(!endpoint.success)return NextResponse.json({error:'Endpoint non valido.'},{status:400});
  const {error}=await service.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',endpoint.data);
  return NextResponse.json({ok:!error,error:error?.message},{status:error?400:200});
}
