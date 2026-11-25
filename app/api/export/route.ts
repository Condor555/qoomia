import {createClient} from '../../../lib/supabase/server';
const esc=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
export async function GET(){
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();
  if(!user)return new Response('Unauthorized',{status:401});
  const {data,error}=await sb.from('transactions').select('date,category_name,amount,currency,note,account_name,source,created_at').eq('user_id',user.id).order('date');
  if(error)return new Response(error.message,{status:400});
  const head=['Data','Categoria','Importo','Valuta','Nota','Conto','Fonte','Creato il'];
  const rows=(data||[]).map(x=>[x.date,x.category_name,x.amount,x.currency,x.note,x.account_name,x.source,x.created_at]);
  const csv='\uFEFF'+[head,...rows].map(r=>r.map(esc).join(';')).join('\r\n');
  return new Response(csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="qoomia-movimenti-${new Date().toISOString().slice(0,10)}.csv"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
