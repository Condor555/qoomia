import {NextResponse} from 'next/server';
import {z} from 'zod';
import {activeSpace} from '../../../../lib/active-space';
import {safeEvaluateSpaceNotifications} from '../../../../lib/push-notifications';
const Patch=z.object({date:z.string(),category_name:z.string().min(1),amount:z.number(),note:z.string().default(''),account_name:z.string().min(1),kind:z.enum(['expense','income']),scope:z.enum(['occurrence','series']).default('occurrence')});
function recurringId(row:any){return row.recurring_id||(row.source==='recurring'&&typeof row.source_id==='string'?row.source_id.split(':')[0]:null)}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params,{sb,spaceId}=await activeSpace(),body=Patch.parse(await req.json());
    const {data:current,error:readError}=await sb.from('transactions').select('*').eq('space_id',spaceId).eq('id',id).single();
    if(readError||!current)return NextResponse.json({error:readError?.message||'Movimento non trovato.'},{status:404});
    const {data:space,error:spaceError}=await sb.from('spaces').select('account_name').eq('id',spaceId).single();
    if(spaceError)return NextResponse.json({error:spaceError.message},{status:400});
    const {data:category}=await sb.from('categories').select('kind').eq('space_id',spaceId).eq('name',body.category_name).maybeSingle();
    if(!category||category.kind!==body.kind)return NextResponse.json({error:`Seleziona una categoria di ${body.kind==='income'?'entrata':'spesa'}.`},{status:409});
    const accountName=space?.account_name||'Spese';
    const amount=body.kind==='expense'?-Math.abs(body.amount):Math.abs(body.amount);
    const {data,error}=await sb.from('transactions').update({date:body.date,category_name:body.category_name,amount,note:body.note,account_name:accountName}).eq('space_id',spaceId).eq('id',id).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400});
    const seriesId=recurringId(current);
    if(body.scope==='series'&&seriesId){
      const {error:seriesError}=await sb.from('recurring_transactions').update({category_name:body.category_name,amount,note:body.note,account_name:accountName}).eq('space_id',spaceId).eq('id',seriesId);
      if(seriesError)return NextResponse.json({error:`Movimento aggiornato, ma serie non aggiornata: ${seriesError.message}`,data},{status:409});
    }
    await safeEvaluateSpaceNotifications(spaceId,['budget']);
    return NextResponse.json({data,seriesUpdated:body.scope==='series'&&Boolean(seriesId)});
  }catch(error:any){return NextResponse.json({error:error?.message||'Unauthorized'},{status:400})}
}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params,{sb,spaceId}=await activeSpace(),scope=new URL(req.url).searchParams.get('scope')==='series'?'series':'occurrence';
    const {data:current,error:readError}=await sb.from('transactions').select('source,source_id,recurring_id').eq('space_id',spaceId).eq('id',id).single();
    if(readError||!current)return NextResponse.json({error:readError?.message||'Movimento non trovato.'},{status:404});
    const seriesId=recurringId(current);
    if(scope==='series'&&seriesId){const {error:seriesError}=await sb.from('recurring_transactions').update({active:false}).eq('space_id',spaceId).eq('id',seriesId);if(seriesError)return NextResponse.json({error:seriesError.message},{status:400})}
    const {error}=await sb.from('transactions').delete().eq('space_id',spaceId).eq('id',id);
    if(!error)await safeEvaluateSpaceNotifications(spaceId,['budget']);
    return NextResponse.json({ok:!error,error:error?.message,seriesStopped:scope==='series'&&Boolean(seriesId)},{status:error?400:200});
  }catch(error:any){return NextResponse.json({error:error?.message||'Unauthorized'},{status:400})}
}
