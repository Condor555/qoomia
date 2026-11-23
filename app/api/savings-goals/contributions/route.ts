import {NextResponse} from 'next/server';
import {z} from 'zod';
import {activeSpace} from '../../../../lib/active-space';
import {safeEvaluateSpaceNotifications} from '../../../../lib/push-notifications';

const Contribution=z.object({
  space_id:z.string().uuid().optional(),
  goal_id:z.string().uuid(),
  amount:z.number().positive().max(1_000_000_000),
  contribution_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note:z.string().max(200).default(''),
});
const ContributionUpdate=Contribution.extend({id:z.string().uuid()});

async function contributionAccess(sb:any,spaceId:string,userId:string,id:string){
  const [{data:row},{data:membership},{data:space}]=await Promise.all([
    sb.from('saving_goal_contributions').select('id,goal_id,contributed_by').eq('space_id',spaceId).eq('id',id).maybeSingle(),
    sb.from('space_members').select('role').eq('space_id',spaceId).eq('user_id',userId).maybeSingle(),
    sb.from('spaces').select('created_by').eq('id',spaceId).single(),
  ]);
  const owner=membership?.role==='owner'||space?.created_by===userId;
  return {row,owner,allowed:Boolean(row&&(row.contributed_by===userId||owner))};
}

export async function POST(req:Request){
  try{
    const body=Contribution.parse(await req.json());
    const {sb,user,spaceId}=await activeSpace(body.space_id);
    const [{data:goal},{data:existing}]=await Promise.all([
      sb.from('saving_goals').select('id,status,target_amount').eq('space_id',spaceId).eq('id',body.goal_id).maybeSingle(),
      sb.from('saving_goal_contributions').select('amount').eq('space_id',spaceId).eq('goal_id',body.goal_id),
    ]);
    const accumulated=(existing||[]).reduce((sum,row)=>sum+Number(row.amount),0);
    if(!goal||goal.status!=='active'||accumulated>=Number(goal.target_amount))return NextResponse.json({error:'Obiettivo non disponibile.'},{status:409});
    const {data,error}=await sb.from('saving_goal_contributions').insert({space_id:spaceId,goal_id:body.goal_id,amount:body.amount,contribution_date:body.contribution_date,note:body.note,contributed_by:user.id}).select().single();
    if(!error)await safeEvaluateSpaceNotifications(spaceId,['goal']);
    return NextResponse.json({data,error:error?.message,transactionCreated:false},{status:error?400:200});
  }catch(error:any){
    if(error instanceof z.ZodError)return NextResponse.json({error:'Contributo non valido.'},{status:400});
    return NextResponse.json({error:error?.message||'Unauthorized'},{status:400});
  }
}

export async function GET(req:Request){
  try{
    const url=new URL(req.url);const goalId=z.string().uuid().parse(url.searchParams.get('goalId'));
    const {sb,user,spaceId}=await activeSpace(url.searchParams.get('spaceId'));
    const [{data,error},{data:membership},{data:space}]=await Promise.all([
      sb.from('saving_goal_contributions').select('id,amount,contribution_date,note,contributed_by,created_at').eq('space_id',spaceId).eq('goal_id',goalId).order('contribution_date',{ascending:false}).order('created_at',{ascending:false}),
      sb.from('space_members').select('role').eq('space_id',spaceId).eq('user_id',user.id).maybeSingle(),
      sb.from('spaces').select('created_by').eq('id',spaceId).single(),
    ]);
    if(error)return NextResponse.json({data:[],error:error.message},{status:400});
    const owner=membership?.role==='owner'||space?.created_by===user.id;
    const ids=[...new Set((data||[]).map(row=>row.contributed_by).filter(Boolean))];
    const {data:profiles}=ids.length?await sb.from('profiles').select('user_id,display_name').in('user_id',ids):{data:[]};
    const names=new Map((profiles||[]).map(profile=>[profile.user_id,profile.display_name||'Utente']));
    return NextResponse.json({data:(data||[]).map(row=>({...row,author_name:names.get(row.contributed_by)||'Utente',can_edit:row.contributed_by===user.id||owner}))});
  }catch(error:any){return NextResponse.json({error:error?.message||'Unauthorized'},{status:400})}
}

export async function PATCH(req:Request){
  try{
    const body=ContributionUpdate.parse(await req.json());
    const {sb,user,spaceId}=await activeSpace(body.space_id);
    const access=await contributionAccess(sb,spaceId,user.id,body.id);
    if(!access.row)return NextResponse.json({error:'Contributo non trovato.'},{status:404});
    if(!access.allowed)return NextResponse.json({error:'Non puoi modificare il contributo di un altro membro.'},{status:403});
    if(access.row.goal_id!==body.goal_id)return NextResponse.json({error:'Obiettivo non coerente.'},{status:409});
    if(!access.owner){const {data:goal}=await sb.from('saving_goals').select('status').eq('space_id',spaceId).eq('id',body.goal_id).maybeSingle();if(goal?.status!=='active')return NextResponse.json({error:'Solo l’owner può modificare contributi di un obiettivo completato.'},{status:403})}
    const {data,error}=await sb.from('saving_goal_contributions').update({amount:body.amount,contribution_date:body.contribution_date,note:body.note}).eq('space_id',spaceId).eq('id',body.id).select().single();
    if(!error)await safeEvaluateSpaceNotifications(spaceId,['goal']);
    return NextResponse.json({data,error:error?.message,transactionCreated:false},{status:error?400:200});
  }catch(error:any){if(error instanceof z.ZodError)return NextResponse.json({error:'Aggiornamento contributo non valido.'},{status:400});return NextResponse.json({error:error?.message||'Unauthorized'},{status:400})}
}

export async function DELETE(req:Request){
  try{
    const url=new URL(req.url);const id=z.string().uuid().parse(url.searchParams.get('id'));
    const {sb,user,spaceId}=await activeSpace(url.searchParams.get('spaceId'));
    const access=await contributionAccess(sb,spaceId,user.id,id);
    if(!access.row)return NextResponse.json({error:'Contributo non trovato.'},{status:404});
    if(!access.allowed)return NextResponse.json({error:'Non puoi eliminare il contributo di un altro membro.'},{status:403});
    const {error}=await sb.from('saving_goal_contributions').delete().eq('space_id',spaceId).eq('id',id);
    if(!error)await safeEvaluateSpaceNotifications(spaceId,['goal']);
    return NextResponse.json({ok:!error,error:error?.message,transactionDeleted:false},{status:error?400:200});
  }catch(error:any){return NextResponse.json({error:error?.message||'Operazione non valida.'},{status:400})}
}
