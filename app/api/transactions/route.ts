import {NextResponse} from 'next/server';
import {z} from 'zod';
import {activeSpace} from '../../../lib/active-space';

const Schema=z.object({
  date:z.string(),
  category_name:z.string().min(1),
  amount:z.number(),
  currency:z.string().default('EUR'),
  note:z.string().default(''),
  account_name:z.string().default('Spese'),
  kind:z.enum(['expense','income','transfer']).default('expense'),
  space_id:z.string().uuid().optional(),
});

export async function GET(req:Request){
  try{
    const url=new URL(req.url);
    const {sb,spaceId}=await activeSpace(url.searchParams.get('spaceId'));
    const q=(url.searchParams.get('q')||'').trim().slice(0,120);
    const author=url.searchParams.get('author')||'';
    const category=url.searchParams.get('category')||'';
    const kind=url.searchParams.get('kind')||'';
    const start=url.searchParams.get('start')||'';
    const end=url.searchParams.get('end')||'';
    const page=Math.max(1,Number(url.searchParams.get('page')||1));
    const size=50;
    let query=sb.from('transactions').select('*',{count:'exact'}).eq('space_id',spaceId).order('date',{ascending:false}).order('created_at',{ascending:false}).range((page-1)*size,page*size-1);
    if(q)query=query.ilike('note',`%${q}%`);
    if(author)query=query.eq('created_by',author);
    if(category)query=query.eq('category_name',category);
    if(kind==='expense')query=query.lt('amount',0);
    if(kind==='income')query=query.gt('amount',0);
    if(/^\d{4}-\d{2}-\d{2}$/.test(start))query=query.gte('date',start);
    if(/^\d{4}-\d{2}-\d{2}$/.test(end))query=query.lte('date',end);
    const {data,error,count}=await query;
    if(error)return NextResponse.json({error:error.message,data:[],count:0,page,size},{status:400});
    const authorIds=[...new Set((data||[]).map((row:any)=>row.created_by).filter(Boolean))];
    const names=new Map<string,string>();
    if(authorIds.length){
      const {data:profiles}=await sb.from('profiles').select('user_id,display_name').in('user_id',authorIds);
      for(const profile of profiles||[])names.set(profile.user_id,profile.display_name);
    }
    return NextResponse.json({data:(data||[]).map((row:any)=>({...row,author_name:row.created_by?(names.get(row.created_by)||'Utente'):'Importato'})),count:count||0,page,size});
  }catch(error:any){
    return NextResponse.json({error:error?.message||'Unauthorized'},{status:401});
  }
}

export async function POST(req:Request){
  try{
    const {sb,user,spaceId:activeSpaceId}=await activeSpace();
    const payload=Schema.parse(await req.json());
    const spaceId=payload.space_id||activeSpaceId;
    const {data:membership}=await sb.from('space_members').select('space_id').eq('space_id',spaceId).eq('user_id',user.id).maybeSingle();
    if(!membership)return NextResponse.json({error:'Non puoi salvare in questo spazio.'},{status:403});
    const {data:category}=await sb.from('categories').select('name,kind').eq('space_id',spaceId).eq('name',payload.category_name).maybeSingle();
    if(!category)return NextResponse.json({error:'La categoria selezionata non appartiene allo spazio di destinazione.'},{status:409});
    const expectedKind=payload.kind==='income'?'income':'expense';
    if(category.kind!==expectedKind)return NextResponse.json({error:`Seleziona una categoria di ${expectedKind==='income'?'entrata':'spesa'}.`},{status:409});
    const {data:space,error:spaceError}=await sb.from('spaces').select('account_name').eq('id',spaceId).single();
    if(spaceError)return NextResponse.json({error:spaceError.message},{status:400});
    const signed=payload.kind==='expense'?-Math.abs(payload.amount):payload.kind==='income'?Math.abs(payload.amount):payload.amount;
    const {data,error}=await sb.from('transactions').insert({
      user_id:user.id,
      created_by:user.id,
      space_id:spaceId,
      source:'manual',
      date:payload.date,
      category_name:payload.category_name,
      amount:signed,
      currency:payload.currency,
      note:payload.note,
      account_name:space?.account_name||'Spese',
    }).select().single();
    return NextResponse.json({data,error:error?.message},{status:error?400:200});
  }catch(error:any){
    if(error instanceof z.ZodError)return NextResponse.json({error:error.issues[0]?.message||'Dati non validi.'},{status:400});
    return NextResponse.json({error:error?.message||'Unauthorized'},{status:401});
  }
}
