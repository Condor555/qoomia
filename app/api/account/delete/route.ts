import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '../../../../lib/supabase/server';

const DeleteSchema=z.object({confirmation:z.literal('ELIMINA'),email:z.string().trim().email()});

export async function POST(req:Request){
  const sb=await createClient();
  const {data:{user}}=await sb.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const parsed=DeleteSchema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Conferma non valida.'},{status:400});
  if((user.email||'').toLocaleLowerCase()!==parsed.data.email.toLocaleLowerCase())return NextResponse.json({error:'L’email non corrisponde all’account connesso.'},{status:400});
  const {data,error}=await sb.rpc('delete_own_account',{p_confirmation:parsed.data.confirmation});
  if(error){
    const missing=/function .*delete_own_account|schema cache/i.test(error.message||'');
    return NextResponse.json({error:missing?'Aggiorna prima Supabase con la migration V4.2 per abilitare l’eliminazione sicura.':error.message},{status:missing?503:400});
  }
  return NextResponse.json({data});
}
