import {NextResponse} from 'next/server';
import {z} from 'zod';
import {activeSpace} from '../../../../lib/active-space';
import {safeEvaluateSpaceNotifications,safeNotifyRecurringPosted} from '../../../../lib/push-notifications';
const Payload=z.object({id:z.string().uuid(),due_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
export async function POST(req:Request){try{const {sb,spaceId}=await activeSpace();const body=Payload.parse(await req.json());const {data:recurring}=await sb.from('recurring_transactions').select('id,space_id,note,category_name,amount,currency').eq('id',body.id).eq('space_id',spaceId).maybeSingle();const {data,error}=await sb.rpc('confirm_recurring_payment',{p_recurring_id:body.id,p_due_date:body.due_date});if(!error){const jobs:Promise<unknown>[]=[safeEvaluateSpaceNotifications(spaceId,['budget'])];if(data?.status==='confirmed'&&recurring)jobs.push(safeNotifyRecurringPosted({recurringId:recurring.id,spaceId:recurring.space_id,dueDate:body.due_date,note:recurring.note,categoryName:recurring.category_name,amount:Number(recurring.amount),currency:recurring.currency||'EUR'}));await Promise.all(jobs)}return NextResponse.json({data,error:error?.message},{status:error?400:200})}catch(error){if(error instanceof z.ZodError)return NextResponse.json({error:'Scadenza non valida.'},{status:400});return NextResponse.json({error:'Unauthorized'},{status:401})}}

