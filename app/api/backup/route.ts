import {NextResponse} from 'next/server';
import {createClient} from '../../../lib/supabase/server';
import {cleanDate,cleanNumber,cleanText,isQoomiaBackup,MAX_BACKUP_BYTES,QOOMIA_BACKUP_FORMAT,QOOMIA_BACKUP_VERSION,type BackupSpace,type QoomiaBackup} from '../../../lib/qoomia-backup';

const rows=(value:{data:any[]|null;error:unknown}):any[]=>{if(value.error)throw value.error;return value.data||[]};

export async function GET(){
  try{
    const sb=await createClient();
    const {data:{user}}=await sb.auth.getUser();
    if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const [{data:profile,error:profileError},{data:memberships,error:membershipError}]=await Promise.all([
      sb.from('profiles').select('display_name,language').eq('user_id',user.id).maybeSingle(),
      sb.from('space_members').select('space_id,role,joined_at').eq('user_id',user.id),
    ]);
    if(profileError||membershipError)throw profileError||membershipError;
    const membershipBySpace=new Map<string,{role:string}>((memberships||[]).map((item:any)=>[item.space_id,item]));
    const ids=(memberships||[]).map((item:any)=>item.space_id);
    const {data:allSpaces,error:spacesError}=ids.length?await sb.from('spaces').select('id,name,type,account_name,created_by,created_at').in('id',ids):{data:[],error:null};
    if(spacesError)throw spacesError;
    const owned=(allSpaces||[]).filter((space:any)=>space.created_by===user.id||membershipBySpace.get(space.id)?.role==='owner');
    const excludedSharedSpaces=(allSpaces||[]).filter((space:any)=>space.type==='shared'&&!owned.some((item:any)=>item.id===space.id)).map((space:any)=>({name:space.name,reason:'member-not-owner'}));
    const spaces:BackupSpace[]=[];
    for(const space of owned){
      const [categories,transactions,recurring,budgets,budgetMacros,macroAllocations,savingGoals,savingGoalContributions]=await Promise.all([
        sb.from('categories').select('name,parent_name,kind,icon,color,macro_category_id,created_at').eq('space_id',space.id).order('name'),
        sb.from('transactions').select('id,date,category_name,amount,currency,note,account_name,source,source_id,recurring_id,recurring_due_date,created_at').eq('space_id',space.id).order('date'),
        sb.from('recurring_transactions').select('id,note,category_name,amount,currency,account_name,frequency,interval_count,next_run,last_generated,active,kind,auto_post,created_at').eq('space_id',space.id).order('next_run'),
        sb.from('budgets').select('month,category_name,amount,created_at,updated_at').eq('space_id',space.id).order('month'),
        sb.from('budget_macro_categories').select('id,name,color,sort_order,rollover_enabled,created_at,updated_at').eq('space_id',space.id).order('sort_order'),
        sb.from('macro_budget_allocations').select('month,macro_category_id,allocation_percent,base_amount,rollover_amount,created_at,updated_at').eq('space_id',space.id).order('month'),
        sb.from('saving_goals').select('id,name,icon,color,target_amount,target_date,status,linked_category_name,created_at,updated_at').eq('space_id',space.id).order('created_at'),
        sb.from('saving_goal_contributions').select('goal_id,amount,contribution_date,note,created_at').eq('space_id',space.id).order('contribution_date'),
      ]);
      const macros=rows(budgetMacros),goals=rows(savingGoals);
      const macroNames=new Map(macros.map(item=>[item.id,item.name]));
      const goalKeys=new Map(goals.map(item=>[item.id,item.id]));
      spaces.push({
        key:space.id,name:space.name,type:space.type,accountName:space.account_name||'Spese',
        categories:rows(categories).map(({macro_category_id,...item})=>({...item,macro_name:macro_category_id?macroNames.get(macro_category_id)||null:null})),
        transactions:rows(transactions).map(({id,...item})=>({...item,backup_key:id})),
        recurring:rows(recurring).map(({id,...item})=>({...item,backup_key:id})),
        budgets:rows(budgets),
        budgetMacros:macros.map(({id,...item})=>({...item,backup_key:id})),
        macroAllocations:rows(macroAllocations).map(({macro_category_id,...item})=>({...item,macro_name:macroNames.get(macro_category_id)||''})),
        savingGoals:goals.map(({id,...item})=>({...item,backup_key:id})),
        savingGoalContributions:rows(savingGoalContributions).map(({goal_id,...item})=>({...item,goal_key:goalKeys.get(goal_id)||goal_id})),
      });
    }
    const backup:QoomiaBackup={format:QOOMIA_BACKUP_FORMAT,version:QOOMIA_BACKUP_VERSION,exportedAt:new Date().toISOString(),backupId:crypto.randomUUID(),profile:{displayName:profile?.display_name||String(user.user_metadata?.display_name||user.email?.split('@')[0]||'Utente'),language:profile?.language==='en'?'en':'it',email:user.email||''},spaces,excludedSharedSpaces};
    const body=JSON.stringify(backup,null,2);
    return new Response(body,{headers:{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="qoomia-backup-${new Date().toISOString().slice(0,10)}.json"`,'cache-control':'no-store','x-content-type-options':'nosniff'}});
  }catch(error:any){return NextResponse.json({error:error?.message||'Impossibile creare il backup.'},{status:400})}
}

export async function POST(req:Request){
  try{
    const sb=await createClient();
    const {data:{user}}=await sb.auth.getUser();
    if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const form=await req.formData();
    const file=form.get('file');
    const targetSpaceId=cleanText(form.get('target_space_id'),80);
    const sourceKey=cleanText(form.get('source_key'),80);
    if(!(file instanceof File)||!targetSpaceId||!sourceKey)return NextResponse.json({error:'File, spazio origine o destinazione mancanti.'},{status:400});
    if(file.size>MAX_BACKUP_BYTES)return NextResponse.json({error:'Il backup supera il limite di 10 MB.'},{status:413});
    let backup:unknown;try{backup=JSON.parse(await file.text())}catch{return NextResponse.json({error:'Il file JSON non è valido.'},{status:400})}
    if(!isQoomiaBackup(backup))return NextResponse.json({error:'Backup Qoomia non riconosciuto o versione non supportata.'},{status:400});
    const source=backup.spaces.find(space=>space.key===sourceKey);
    if(!source)return NextResponse.json({error:'Spazio origine non presente nel backup.'},{status:400});
    const [{data:membership},{data:target,error:targetError}]=await Promise.all([
      sb.from('space_members').select('role').eq('space_id',targetSpaceId).eq('user_id',user.id).maybeSingle(),
      sb.from('spaces').select('id,created_by,account_name').eq('id',targetSpaceId).single(),
    ]);
    if(targetError||!target)return NextResponse.json({error:'Spazio di destinazione non disponibile.'},{status:404});
    if(target.created_by!==user.id&&membership?.role!=='owner')return NextResponse.json({error:'Solo l’owner può ripristinare un backup nello spazio.'},{status:403});

    const result={categories:0,transactions:0,recurring:0,budgets:0,macros:0,allocations:0,goals:0,contributions:0,duplicates:0};
    const macroRows=source.budgetMacros.map((row,index)=>({space_id:targetSpaceId,name:cleanText(row.name,60)||`Voce ${index+1}`,color:/^#[0-9a-f]{6}$/i.test(String(row.color||''))?String(row.color):'#68738C',sort_order:Math.max(0,Math.round(cleanNumber(row.sort_order))),rollover_enabled:Boolean(row.rollover_enabled),created_by:user.id}));
    if(macroRows.length){const {error}=await sb.from('budget_macro_categories').upsert(macroRows,{onConflict:'space_id,name'});if(error)throw error;result.macros=macroRows.length}
    const {data:targetMacros,error:targetMacrosError}=await sb.from('budget_macro_categories').select('id,name').eq('space_id',targetSpaceId);if(targetMacrosError)throw targetMacrosError;
    const macroByName=new Map<string,string>((targetMacros||[]).map((item:any)=>[item.name,item.id]));

    const categoryRows=source.categories.map(row=>({user_id:user.id,space_id:targetSpaceId,name:cleanText(row.name,80),parent_name:cleanText(row.parent_name,80)||null,kind:row.kind==='income'?'income':'expense',icon:cleanText(row.icon,80)||null,color:/^#[0-9a-f]{6}$/i.test(String(row.color||''))?String(row.color):null,macro_category_id:row.kind==='income'?null:macroByName.get(cleanText(row.macro_name,60))||null})).filter(row=>row.name);
    if(categoryRows.length){const {error}=await sb.from('categories').upsert(categoryRows,{onConflict:'space_id,name'});if(error)throw error;result.categories=categoryRows.length}

    const transactionRows=source.transactions.map((row,index)=>({user_id:user.id,created_by:user.id,space_id:targetSpaceId,source:'qoomia-backup',source_id:`${backup.backupId}:${source.key}:${cleanText(row.backup_key,100)||index}`,date:cleanDate(row.date),category_name:cleanText(row.category_name,80),amount:cleanNumber(row.amount),currency:cleanText(row.currency,8)||'EUR',note:cleanText(row.note,500),account_name:target.account_name||'Spese'})).filter(row=>row.date&&row.category_name&&Number.isFinite(row.amount));
    for(let index=0;index<transactionRows.length;index+=500){const batch=transactionRows.slice(index,index+500);const {data,error}=await sb.from('transactions').upsert(batch,{onConflict:'user_id,source,source_id',ignoreDuplicates:true}).select('id');if(error)throw error;result.transactions+=data?.length||0;result.duplicates+=batch.length-(data?.length||0)}

    const {data:existingRecurring,error:existingRecurringError}=await sb.from('recurring_transactions').select('note,category_name,amount,frequency,interval_count,next_run').eq('space_id',targetSpaceId);if(existingRecurringError)throw existingRecurringError;
    const recurringKey=(row:any)=>[cleanText(row.note,500),cleanText(row.category_name,80),cleanNumber(row.amount),cleanText(row.frequency,20),Math.max(1,Math.round(cleanNumber(row.interval_count)||1)),cleanDate(row.next_run)].join('|');
    const existingRecurringKeys=new Set((existingRecurring||[]).map(recurringKey));
    const recurringRows=source.recurring.map(row=>({user_id:user.id,created_by:user.id,space_id:targetSpaceId,note:cleanText(row.note,500),category_name:cleanText(row.category_name,80),amount:cleanNumber(row.amount),currency:cleanText(row.currency,8)||'EUR',account_name:target.account_name||'Spese',frequency:['weekly','monthly','yearly'].includes(String(row.frequency))?String(row.frequency):'monthly',interval_count:Math.max(1,Math.round(cleanNumber(row.interval_count)||1)),next_run:cleanDate(row.next_run),last_generated:cleanDate(row.last_generated)||null,active:Boolean(row.active),kind:row.kind==='subscription'?'subscription':'recurring',auto_post:row.auto_post!==false})).filter(row=>row.next_run&&row.category_name&&!existingRecurringKeys.has(recurringKey(row)));
    if(recurringRows.length){const {error}=await sb.from('recurring_transactions').insert(recurringRows);if(error)throw error;result.recurring=recurringRows.length}

    const budgetRows=source.budgets.map(row=>({space_id:targetSpaceId,month:cleanDate(row.month),category_name:cleanText(row.category_name,80)||null,amount:Math.max(0,cleanNumber(row.amount)),created_by:user.id})).filter(row=>row.month&&row.month.endsWith('-01'));
    if(budgetRows.length){const {error}=await sb.from('budgets').upsert(budgetRows,{onConflict:'space_id,month,category_key'});if(error)throw error;result.budgets=budgetRows.length}
    const allocationRows=source.macroAllocations.map(row=>({space_id:targetSpaceId,month:cleanDate(row.month),macro_category_id:macroByName.get(cleanText(row.macro_name,60)),allocation_percent:Math.min(100,Math.max(0,cleanNumber(row.allocation_percent))),base_amount:Math.max(0,cleanNumber(row.base_amount)),rollover_amount:Math.max(0,cleanNumber(row.rollover_amount)),created_by:user.id})).filter(row=>row.month&&row.macro_category_id);
    if(allocationRows.length){const {error}=await sb.from('macro_budget_allocations').upsert(allocationRows,{onConflict:'space_id,month,macro_category_id'});if(error)throw error;result.allocations=allocationRows.length}

    const {data:existingGoals,error:existingGoalsError}=await sb.from('saving_goals').select('id,name,target_amount,target_date').eq('space_id',targetSpaceId);if(existingGoalsError)throw existingGoalsError;
    const goalMap=new Map<string,string>();
    for(const row of source.savingGoals){
      const name=cleanText(row.name,80),targetAmount=Math.max(.01,cleanNumber(row.target_amount)),targetDate=cleanDate(row.target_date)||null;
      if(!name)continue;
      const existing=(existingGoals||[]).find((item:any)=>item.name===name&&Number(item.target_amount)===targetAmount&&(item.target_date||null)===targetDate);
      let id=existing?.id;
      if(!id){const {data,error}=await sb.from('saving_goals').insert({space_id:targetSpaceId,name,icon:cleanText(row.icon,80)||'piggy-bank',color:/^#[0-9a-f]{6}$/i.test(String(row.color||''))?String(row.color):'#35A96B',target_amount:targetAmount,target_date:targetDate,status:'active',linked_category_name:cleanText(row.linked_category_name,80)||null,created_by:user.id}).select('id').single();if(error)throw error;id=data.id;result.goals++}
      goalMap.set(cleanText(row.backup_key,100),id);
    }
    const {data:existingContributions}=await sb.from('saving_goal_contributions').select('goal_id,amount,contribution_date,note').eq('space_id',targetSpaceId);
    const contributionKey=(row:any)=>[row.goal_id,cleanNumber(row.amount),cleanDate(row.contribution_date),cleanText(row.note,500)].join('|');
    const contributionKeys=new Set((existingContributions||[]).map(contributionKey));
    const contributionRows=source.savingGoalContributions.map(row=>({goal_id:goalMap.get(cleanText(row.goal_key,100)),space_id:targetSpaceId,amount:Math.max(.01,cleanNumber(row.amount)),contribution_date:cleanDate(row.contribution_date),note:cleanText(row.note,500),contributed_by:user.id})).filter(row=>row.goal_id&&row.contribution_date&&!contributionKeys.has(contributionKey(row)));
    if(contributionRows.length){const {error}=await sb.from('saving_goal_contributions').insert(contributionRows);if(error)throw error;result.contributions=contributionRows.length}
    for(const row of source.savingGoals){if(row.status==='completed'){const id=goalMap.get(cleanText(row.backup_key,100));if(id)await sb.from('saving_goals').update({status:'completed'}).eq('space_id',targetSpaceId).eq('id',id)}}

    return NextResponse.json({data:result,sourceSpace:source.name,targetSpaceId,mode:'merge'});
  }catch(error:any){return NextResponse.json({error:error?.message||'Ripristino non riuscito.'},{status:400})}
}
