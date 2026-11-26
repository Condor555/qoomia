import fs from 'node:fs';
import ts from 'typescript';

const read=file=>fs.readFileSync(file,'utf8');
const checks=[];
const expect=(label,condition)=>checks.push({label,condition:Boolean(condition)});
const cron=JSON.parse(read('vercel.json'));
const route=read('app/api/recurring/run/route.ts');
const migration=read('supabase/migrations/20261126_v4_3_2_autopost_smart_finance.sql');
const stats=read('app/api/stats/route.ts');
const finance=read('lib/smart-finance.ts');
const notifications=read('lib/push-notifications.ts');
const preferences=read('app/api/notifications/preferences/route.ts');
const preferencesUi=read('app/account/notifiche/page.tsx');
const statisticsUi=read('app/statistiche/page.tsx');
const homeCard=read('components/MonthlyInsightCard.tsx');

expect('Vercel Cron punta alla route ricorrenze',cron.crons?.some(item=>item.path==='/api/recurring/run'&&item.schedule));
expect('La route Cron espone GET e verifica CRON_SECRET',route.includes('export async function GET')&&route.includes('CRON_SECRET')&&route.includes('process_due_recurring'));
expect('Catch-up utente disponibile via POST',route.includes('export async function POST')&&route.includes("rpc('confirm_recurring_payment'"));
expect('Migration auto-post protetta service_role',migration.includes("auth.role(),'')<>'service_role'")&&migration.includes('grant execute on function public.process_due_recurring(date) to service_role'));
expect('Auto-post idempotente per occorrenza',migration.includes('on conflict (recurring_id,recurring_due_date)')&&migration.includes('on conflict(recurring_id,due_date) do nothing'));
expect('Notifiche ricorrenze persistite e deduplicate',migration.includes("kind in ('budget','goal','recurring')")&&notifications.includes('notifyRecurringPosted')&&notifications.includes("kind:'recurring'"));
expect('Preferenza Movimenti ricorrenti end-to-end',migration.includes('recurring_enabled')&&preferences.includes('recurringEnabled')&&preferencesUi.includes('Movimenti ricorrenti'));
expect('Smart Finance usa ricorrenze e storico',stats.includes('buildSmartFinanceForecast')&&finance.includes("source:'recurring'")&&finance.includes("source:'history'"));
expect('Formula saldo prevista esplicita',finance.includes('currentBalance+scheduledIncome+historicalIncome-scheduledExpense-variableExpense'));
expect('Smart Finance visibile in Statistiche e Home',statisticsUi.includes('Previsione di fine mese')&&statisticsUi.includes('smart-finance-formula')&&homeCard.includes('Saldo previsto'));

for(const file of ['app/api/recurring/run/route.ts','app/api/stats/route.ts','app/api/notifications/preferences/route.ts','app/account/notifiche/page.tsx','app/statistiche/page.tsx','components/MonthlyInsightCard.tsx','lib/push-notifications.ts','lib/smart-finance.ts']){
  const result=ts.transpileModule(read(file),{compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  expect(`Sintassi ${file}`,!(result.diagnostics||[]).some(item=>item.category===ts.DiagnosticCategory.Error));
}

const failures=checks.filter(item=>!item.condition);
for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);
if(failures.length){console.error(`Verifica V4.3.2 fallita: ${failures.length} controllo/i.`);process.exit(1)}
console.log(`Verifica V4.3.2 completata: ${checks.length} controlli superati.`);
