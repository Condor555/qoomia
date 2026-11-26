import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from '/opt/oai-docgen/node_modules/typescript/lib/typescript.js';

const read=path=>fs.readFileSync(path,'utf8');
const checks=[];const expect=(label,condition)=>checks.push({label,condition:Boolean(condition)});
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));
const engine=read('lib/smart-finance-forecast.ts');
const api=read('app/api/stats/route.ts');
const home=read('app/page.tsx');
const stats=read('app/statistiche/page.tsx');
const insight=read('lib/qoomia-insights.ts');
const info=read('app/account/informazioni/page.tsx');

expect('Versione V4.3.0 coerente',pkg.version==='4.3.0'&&lock.version==='4.3.0'&&lock.packages[''].version==='4.3.0'&&pkg.scripts.test.includes('verify-v4.3.0.mjs'));
expect('Motore Smart Finance presente',engine.includes('buildMonthEndForecast')&&engine.includes('projectedBalance')&&engine.includes('futureRecurringExpense'));
expect('Ritmo discrezionale separato dalle ricorrenze',engine.includes('discretionaryExpense/timing.daysConsidered*timing.daysInMonth')&&engine.includes('fixedExpense+projectedDiscretionaryExpense+futureRecurringExpense'));
expect('Ricorrenze già contabilizzate non duplicate',engine.includes('paidOccurrences')&&engine.includes('recurring_due_date||row.date')&&engine.includes("`${rule.id}:${dueDate}`"));
expect('API isolata per spazio attivo',api.includes('activeSpace(')&&api.includes(".eq('space_id',spaceId)")&&api.includes('buildMonthEndForecast'));
expect('Home mantiene una sola card Insight',home.includes('<MonthlyInsightCard')&&(home.match(/<MonthlyInsightCard\b/g)||[]).length===1&&home.includes('balance-forecast'));
expect('Statistiche espone il saldo previsto',stats.includes('stats-forecast')&&stats.includes('forecast.projectedBalance')&&stats.includes('futureRecurringCount'));
expect('Insight prioritario usa il forecast',insight.includes("id:'negative-balance-forecast'")&&insight.includes("id:'balance-forecast'"));
expect('Informazioni aggiornate',info.includes('Versione 4.3.0')&&info.includes('Smart Finance'));

for(const file of ['lib/smart-finance-forecast.ts','app/api/stats/route.ts','app/page.tsx','components/MonthlyInsightCard.tsx','lib/qoomia-insights.ts','app/statistiche/page.tsx']){
  const result=ts.transpileModule(read(file),{compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  expect(`Sintassi ${file}`,!(result.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error));
}

const failures=checks.filter(item=>!item.condition);
for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);
if(failures.length){console.error(`Verifica V4.3.0 fallita: ${failures.length} controllo/i.`);process.exit(1)}
console.log(`Verifica V4.3.0 completata: ${checks.length} controlli superati.`);