import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const checks=[];
function expect(name,value){checks.push({name,ok:Boolean(value)});if(!value)process.exitCode=1}

const cron=JSON.parse(read('vercel.json'));
const run=read('app/api/recurring/run/route.ts');
const confirm=read('app/api/recurring/confirm/route.ts');
const push=read('lib/push-notifications.ts');
const prefs=read('app/api/notifications/preferences/route.ts');
const page=read('app/account/notifiche/page.tsx');
const migration=read('supabase/migrations/20261126_v4_3_recurring_auto_post_notifications.sql');

expect('Cron giornaliero configurato',cron.crons?.some(item=>item.path==='/api/recurring/run'&&item.schedule==='10 0 * * *'));
expect('Cron protetto da CRON_SECRET',run.includes("process.env.CRON_SECRET")&&run.includes("Bearer ${secret}"));
expect('Data calcolata nel fuso Europe/Rome',run.includes("timeZone:'Europe/Rome'"));
expect('Runner usa client service-role',run.includes('SUPABASE_SERVICE_ROLE_KEY')&&run.includes('confirm_recurring_payment_for_cron'));
expect('Runner seleziona solo ricorrenze auto-post',run.includes(".eq('active',true).eq('auto_post',true)"));
expect('Recupero arretrati con limite',run.includes('guard++<24')&&run.includes('limite recupero scadenze'));
expect('Notifica solo dopo nuova conferma',run.includes("confirmation?.status==='confirmed'")&&run.includes('safeNotifyRecurringPosted'));
expect('Conferma manuale notifica il movimento',confirm.includes("data?.status==='confirmed'")&&confirm.includes('safeNotifyRecurringPosted'));
expect('Preferenza ricorrenze nell API',prefs.includes('recurring_enabled')&&prefs.includes('recurringEnabled'));
expect('Preferenza ricorrenze nella UI',page.includes('preferences.recurringEnabled')&&page.includes('registrata automaticamente'));
expect('Tipo notifica recurring supportato',push.includes("'budget'|'goal'|'recurring'"));
expect('Deduplicazione notifica per ricorrenza e data',push.includes("period_key:row.dueDate")&&push.includes("kind:'recurring'"));
expect('Payload push apre Movimenti',push.includes("url:'/movimenti'"));
expect('Migration aggiunge recurring_enabled',migration.includes('add column if not exists recurring_enabled'));
expect('RPC cron limitata a service_role',migration.includes("auth.role(),'')<>'service_role'")&&migration.includes('grant execute on function public.confirm_recurring_payment_for_cron(uuid,date) to service_role'));
expect('RPC atomica usa lock',migration.includes('for update'));
expect('RPC impedisce duplicati',migration.includes("'already-confirmed'")&&migration.includes('public.recurring_payments'));
expect('RPC registra autore reale',migration.includes('v_actor:=coalesce(v_rule.created_by,v_rule.user_id)'));

for(const check of checks)console.log(`${check.ok?'PASS':'FAIL'}  ${check.name}`);
console.log(`\n${checks.filter(check=>check.ok).length}/${checks.length} controlli superati`);
