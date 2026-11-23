import {NextResponse} from 'next/server';
import {z} from 'zod';
import {activeSpace} from '../../../lib/active-space';
import {loadMacroBudgetSnapshot,MONTH_PATTERN,monthStart,roundMoney,roundPercent} from '../../../lib/macro-budget';
import {safeEvaluateSpaceNotifications} from '../../../lib/push-notifications';

const PlanPayload=z.object({
  space_id:z.string().uuid().optional(),
  month:z.string().regex(MONTH_PATTERN),
  total_budget:z.number().min(0).max(1_000_000_000),
  allocations:z.array(z.object({macro_category_id:z.string().uuid(),percentage:z.number().min(0).max(100)})).max(100),
});
const LegacyPayload=z.object({space_id:z.string().uuid().optional(),month:z.string().regex(MONTH_PATTERN),category_name:z.string().nullable().optional(),amount:z.number().min(0)});
const previousMonth=(month:string)=>{const [year,value]=month.split('-').map(Number);const date=new Date(Date.UTC(year,value-2,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`};

export async function GET(req:Request){
  try{
    const url=new URL(req.url);const requested=url.searchParams.get('month')||new Date().toISOString().slice(0,7);const month=MONTH_PATTERN.test(requested)?requested:new Date().toISOString().slice(0,7);
    const {sb,user,spaceId}=await activeSpace(url.searchParams.get('spaceId'));
    const [snapshot,{data:membership},{data:space},{data:previousRows,error:previousError}]=await Promise.all([
      loadMacroBudgetSnapshot(sb,spaceId,month),
      sb.from('space_members').select('role').eq('space_id',spaceId).eq('user_id',user.id).maybeSingle(),
      sb.from('spaces').select('created_by').eq('id',spaceId).single(),
      sb.from('transactions').select('amount').eq('space_id',spaceId).gte('date',monthStart(previousMonth(month))).lt('date',monthStart(month)),
    ]);
    if(previousError)return NextResponse.json({error:previousError.message},{status:400});
    const previousExpense=-(previousRows||[]).filter((row:any)=>Number(row.amount)<0).reduce((sum:number,row:any)=>sum+Number(row.amount),0);
    return NextResponse.json({...snapshot,canEdit:membership?.role==='owner'||space?.created_by===user.id,previousExpense,changePercent:previousExpense>0?Math.round((snapshot.totalSpent-previousExpense)/previousExpense*100):null});
  }catch(error:unknown){
    const message=error instanceof Error?error.message:'';
    if(message==='Unauthorized')return NextResponse.json({error:'Unauthorized'},{status:401});
    console.error('Budget snapshot load failed',error);
    return NextResponse.json({error:'Impossibile caricare il budget per il periodo selezionato.'},{status:400});
  }
}

export async function PUT(req:Request){
  try{
    const raw=await req.json();
    if('total_budget' in raw){
      const payload=PlanPayload.parse(raw);const {sb,spaceId}=await activeSpace(payload.space_id);
      const duplicateIds=new Set(payload.allocations.map(item=>item.macro_category_id));
      if(duplicateIds.size!==payload.allocations.length)return NextResponse.json({error:'Ogni voce Budget può comparire una sola volta.'},{status:400});
      const totalPercent=payload.allocations.reduce((sum,item)=>sum+item.percentage,0);
      if(totalPercent>100.001)return NextResponse.json({error:'La somma delle percentuali non può superare il 100%.'},{status:400});
      const snapshot=await loadMacroBudgetSnapshot(sb,spaceId,payload.month);
      const macroMap=new Map(snapshot.macros.map(item=>[item.id,item]));
      const distributable=Math.max(0,payload.total_budget-snapshot.commitments);
      const allocations=payload.allocations.map(item=>{
        const macro=macroMap.get(item.macro_category_id);if(!macro)throw new Error('Macro-categoria non valida per lo spazio.');
        return {macro_category_id:item.macro_category_id,allocation_percent:roundPercent(item.percentage),base_amount:roundMoney(distributable*item.percentage/100),rollover_amount:macro.rolloverAmount};
      });
      const {data,error}=await sb.rpc('save_macro_budget_plan',{p_space_id:spaceId,p_month:monthStart(payload.month),p_total_amount:roundMoney(payload.total_budget),p_allocations:allocations});
      if(!error)await safeEvaluateSpaceNotifications(spaceId,['budget']);
      return NextResponse.json({data,error:error?.message},{status:error?400:200});
    }
    // Compatibilità con il payload V3.9: non elimina né trasforma i budget categoria legacy.
    const payload=LegacyPayload.parse(raw);const {sb,spaceId}=await activeSpace(payload.space_id);
    const {data,error}=await sb.rpc('set_space_budget',{p_space_id:spaceId,p_month:monthStart(payload.month),p_category_name:payload.category_name||null,p_amount:payload.amount});
    if(!error)await safeEvaluateSpaceNotifications(spaceId,['budget']);
    return NextResponse.json({data,legacy:true,error:error?.message},{status:error?400:200});
  }catch(error:any){
    if(error instanceof z.ZodError)return NextResponse.json({error:'Piano budget non valido.'},{status:400});
    return NextResponse.json({error:error?.message||'Unauthorized'},{status:error?.message==='Unauthorized'?401:400});
  }
}
