import {NextResponse} from 'next/server';
import {activeSpace} from '../../../../lib/active-space';

export async function GET(req:Request){
  try{
    const url=new URL(req.url);
    const kind=url.searchParams.get('kind')==='income'?'income':'expense';
    const {sb,spaceId}=await activeSpace(url.searchParams.get('spaceId'));
    let query=sb.from('transactions').select('category_name,amount,date,created_at').eq('space_id',spaceId).order('date',{ascending:false}).order('created_at',{ascending:false}).limit(250);
    query=kind==='income'?query.gt('amount',0):query.lt('amount',0);
    const {data,error}=await query;
    if(error)return NextResponse.json({error:error.message,frequent:[],recent:[]},{status:400});
    const rows=data||[];
    const recent:string[]=[];
    const counts=new Map<string,number>();
    for(const row of rows){
      const name=String(row.category_name||'').trim();
      if(!name)continue;
      counts.set(name,(counts.get(name)||0)+1);
      if(!recent.includes(name)&&recent.length<8)recent.push(name);
    }
    const frequent=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'it')).slice(0,10).map(([name])=>name);
    return NextResponse.json({recent,frequent});
  }catch(error:any){
    return NextResponse.json({error:error?.message||'Unauthorized',recent:[],frequent:[]},{status:401});
  }
}
