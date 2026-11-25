import fs from 'node:fs';
import ts from 'typescript';

const read=path=>fs.readFileSync(path,'utf8');
const checks=[];const expect=(label,condition)=>checks.push({label,condition:Boolean(condition)});
const engine=read('lib/qoomia-insights.ts'),home=read('app/page.tsx'),card=read('components/MonthlyInsightCard.tsx'),stats=read('app/statistiche/page.tsx'),overview=read('components/InsightsOverview.tsx'),nav=read('components/Nav.tsx'),css=read('app/globals.css');
expect('Motore Insights condiviso e deterministico',engine.includes('buildQoomiaInsights')&&!engine.match(/fetch\(|openai|anthropic|gemini/i));
expect('Priorità rischio Budget e aumento spese',engine.includes("priority:98")&&engine.includes("id:'expense-spike'")&&engine.includes("id:'month-projection'"));
expect('Soglie evitano insight artificiali',engine.includes('expenseChange>=25')&&engine.includes('Math.abs(delta)>=15')&&engine.includes('share>=35'));
expect('Home mostra un solo insight prioritario',card.includes('limit:1')&&home.includes('<MonthlyInsightCard')&&!home.includes('<InsightsOverview'));
expect('Home non effettua nuove chiamate per Insights',!card.includes('fetch(')&&!engine.includes('/api/'));
expect('Statistiche integra massimo tre insight',stats.includes('<InsightsOverview')&&overview.includes('limit:3'));
expect('Insight secondari sono righe leggere',overview.includes('insights-overview-list')&&overview.includes('insights-overview-row'));
expect('Drill-down usa Movimenti e Budget esistenti',engine.includes('/movimenti?')&&engine.includes("href:'/budget'"));
expect('Nessuna nuova voce nella navigazione',!nav.match(/href:\s*['"]\/insights/));
expect('Separazione spazio ereditata dai dati Statistiche',stats.includes("params.set('spaceId',targetSpaceId)")&&home.includes("params.set('spaceId',targetSpaceId)"));
expect('UI spiega le destinazioni contestuali',overview.includes('Ogni osservazione apre il dettaglio più utile')&&overview.includes('insight.actionLabel'));
expect('Stili Insights presenti',css.includes('.insights-overview{')&&css.includes('.insights-overview-row{'));
for(const file of ['lib/qoomia-insights.ts','components/InsightsOverview.tsx','components/MonthlyInsightCard.tsx','app/page.tsx','app/statistiche/page.tsx']){const source=read(file);const result=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});expect(`Sintassi ${file}`,!(result.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error))}
const failures=checks.filter(item=>!item.condition);for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);if(failures.length){console.error(`Verifica V4.1.9 fallita: ${failures.length} controllo/i.`);process.exit(1)}console.log(`Verifica V4.1.9 completata: ${checks.length} controlli superati.`);
