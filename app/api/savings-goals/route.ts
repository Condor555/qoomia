import {NextResponse} from 'next/server';
import {z} from 'zod';
import {activeSpace} from '../../../lib/active-space';
import {loadSavingGoals} from '../../../lib/savings-goals';
import {safeEvaluateSpaceNotifications} from '../../../lib/push-notifications';

const Goal=z.object({space_id:z.string().uuid().optional(),name:z.string().trim().min(2).max(80),icon:z.string().max(80).default('piggy-bank'),color:z.string().regex(/^#[0-9A-Fa-f]{6}$/),target_amount:z.number().positive().max(1_000_000_000),target_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),linked_category_name:z.string().nullable().optional()});
const GoalUpdate=Goal.omit({space_id:true}).partial().extend({id:z.string().uuid(),space_id:z.string().uuid().optional(),status:z.enum(['active','completed']).optional()});

async function canManage(sb:any,spaceId:string,userId:string){
  const [{data:membership},{data:space}]=await Promise.all([
    sb.from('space_members').select('role').eq('space_id',spaceId).eq('user_id',userId).maybeSingle(),
    sb.from('spaces').select('created_by').eq('id',spaceId).single(),
  ]);
  return membership?.role==='owner'||space?.created_by===userId;
}

export async function GET(req:Request){
  try{const url=new URL(req.url);const {sb,user,spaceId}=await activeSpace(url.searchParams.get('spaceId'));const [data,{data:membership},{data:space}]=await Promise.all([loadSavingGoals(sb,spaceId,user.id),sb.from('space_members').select('role').eq('space_id',spaceId).eq('user_id',user.id).maybeSingle(),sb.from('spaces').select('created_by').eq('id',spaceId).single()]);return NextResponse.json({data,spaceId,canEdit:membership?.role==='owner'||space?.created_by===user.id})}catch(error:any){return NextResponse.json({error:error?.message||'Unauthorized'},{status:400})}
}
export async function POST(req:Request){
  try{const body=Goal.parse(await req.json());const {sb,user,spaceId}=await activeSpace(body.space_id);if(!await canManage(sb,spaceId,user.id))return NextResponse.json({error:'Solo l’owner può creare obiettivi nello spazio.'},{status:403});const {data,error}=await sb.from('saving_goals').insert({space_id:spaceId,name:body.name,icon:body.icon,color:body.color,target_amount:body.target_amount,target_date:body.target_date||null,linked_category_name:body.linked_category_name||null,created_by:user.id}).select().single();if(!error)await safeEvaluateSpaceNotifications(spaceId,['goal']);return NextResponse.json({data,error:error?.message},{status:error?400:200})}catch(error:any){if(error instanceof z.ZodError)return NextResponse.json({error:'Obiettivo non valido.'},{status:400});return NextResponse.json({error:error?.message||'Unauthorized'},{status:400})}
}
export async function PATCH(req:Request){
  try{const body=GoalUpdate.parse(await req.json());const {sb,user,spaceId}=await activeSpace(body.space_id);if(!await canManage(sb,spaceId,user.id))return NextResponse.json({error:'Solo l’owner può modificare gli obiettivi dello spazio.'},{status:403});const {id,space_id:_,...update}=body;const {data,error}=await sb.from('saving_goals').update(update).eq('space_id',spaceId).eq('id',id).select().single();if(!error)await safeEvaluateSpaceNotifications(spaceId,['goal']);return NextResponse.json({data,error:error?.message},{status:error?400:200})}catch(error:any){if(error instanceof z.ZodError)return NextResponse.json({error:'Aggiornamento non valido.'},{status:400});return NextResponse.json({error:error?.message||'Unauthorized'},{status:400})}
}
export async function DELETE(req:Request){
  try{const url=new URL(req.url);const id=z.string().uuid().parse(url.searchParams.get('id'));const {sb,user,spaceId}=await activeSpace(url.searchParams.get('spaceId'));if(!await canManage(sb,spaceId,user.id))return NextResponse.json({error:'Solo l’owner può eliminare gli obiettivi dello spazio.'},{status:403});const {error}=await sb.from('saving_goals').delete().eq('space_id',spaceId).eq('id',id);return NextResponse.json({ok:!error,error:error?.message},{status:error?400:200})}catch(error:any){return NextResponse.json({error:error?.message||'Operazione non valida.'},{status:400})}
}
