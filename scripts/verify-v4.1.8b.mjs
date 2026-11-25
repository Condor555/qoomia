import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const checks=[];
function expect(label,condition){checks.push({label,condition:Boolean(condition)});}

const pkg=JSON.parse(read('package.json'));
const home=read('app/page.tsx');
const insight=read('components/MonthlyInsightCard.tsx');
const css=read('app/globals.css');

const insightMounts=(home.match(/<MonthlyInsightCard\b/g)||[]).length;
const moneyIndex=home.indexOf('className="money-grid"');
const insightIndex=home.indexOf('<MonthlyInsightCard stats={stats}');
const budgetIndex=home.indexOf('home-budget-summary');

expect('Home mantiene un solo Insight dinamico',insightMounts===1);
expect('Insight resta tra Entrate/Uscite e Budget',moneyIndex>=0&&moneyIndex<insightIndex&&insightIndex<budgetIndex);
expect('Entrate/Uscite restano invariate e affiancate',home.includes("t('common.incomes')")&&home.includes("t('common.expenses')")&&home.includes('className="money-grid"'));
expect('Budget e navigazione restano collegati alla sezione collaudata',home.includes('href="/budget"')&&home.includes('home-budget-teaser'));
expect('Insight deriva dai dati stats esistenti senza nuove API',insight.includes('buildQoomiaInsights')&&!insight.includes('fetch('));
expect('Contratto V4.1.9 documentato nel componente',insight.includes('limit:1')&&read('components/InsightsOverview.tsx').includes('limit:3'));
expect('Icona categoria ridotta a 36 px',insight.includes('size={36}')&&css.includes('grid-template-columns:36px minmax(0,1fr) 14px'));
expect('Una sola chevron resta nel componente',insight.includes('monthly-insight-chevron')&&(insight.match(/monthly-insight-chevron/g)||[]).length===1);
expect('Separazione desktop 24 px',css.includes('margin:24px 0 18px'));
expect('Separazione mobile 20 px',css.includes('@media(max-width:600px){.monthly-insight-card{margin-top:20px'));
expect('Insight alleggerito senza ombra e con bordo attenuato',css.includes('box-shadow:none')&&css.includes('border:1px solid color-mix(in srgb,var(--line) 62%,transparent)'));
expect('Hover Insight non reintroduce ombre o spostamenti',!css.includes('.monthly-insight-card:hover{transform:')&&!css.includes('.monthly-insight-card:hover{box-shadow:'));
expect('Nessuna nuova dipendenza npm',Object.keys(pkg.dependencies||{}).length===9);

const failures=checks.filter(item=>!item.condition);
for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);
if(failures.length){console.error(`Verifica V4.1.8b fallita: ${failures.length} controllo/i.`);process.exit(1)}
console.log(`Verifica V4.1.8b completata: ${checks.length} controlli superati.`);
