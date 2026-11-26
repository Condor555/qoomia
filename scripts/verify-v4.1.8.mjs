import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const checks=[];
function expect(label,condition){checks.push({label,condition:Boolean(condition)});}

const pkg=JSON.parse(read('package.json'));
const home=read('app/page.tsx');
const movements=read('app/movimenti/page.tsx');
const composer=read('components/NewTransactionComposer.tsx');
const insight=read('components/MonthlyInsightCard.tsx');
const sheet=read('components/AdaptiveSheet.tsx');
const manifest=read('app/manifest.ts');
const sw=read('public/sw.js');

expect('versione 4.1.8 o successiva',['4.1.8','4.1.9'].includes(pkg.version)||pkg.version.startsWith('4.2.')||pkg.version.startsWith('4.3.'));
expect('nessuna nuova dipendenza',Object.keys(pkg.dependencies||{}).length===9);
expect('Insight montato in Home',home.includes('<MonthlyInsightCard stats={stats}'));
expect('Insight usa dati stats esistenti',insight.includes('topCategory')&&insight.includes('budget')&&!insight.includes('fetch('));
expect('Movimenti usa AdaptiveSheet',movements.includes('className="transaction-sheet"')&&movements.includes('dirty={editDirty}'));
expect('Movimenti ha skeleton ed empty state',movements.includes('<SkeletonRows')&&movements.includes('<EmptyState'));
expect('Composer mantiene endpoint transazioni',composer.includes("fetch('/api/transactions'")&&composer.includes("method:'POST'"));
expect('Feedback aptico opzionale',composer.includes("hapticFeedback('success')"));
expect('Sheet protegge modifiche non salvate',sheet.includes('if(dirty){setConfirmDiscard(true);return;}'));
expect('PWA standalone invariata',manifest.includes("display:'standalone'")&&manifest.includes("scope:'/'"));
expect('Service Worker non precache API',!sw.match(/PRECACHE[^\n]*\/api\//i));

const failures=checks.filter(item=>!item.condition);
for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);
if(failures.length){console.error(`Verifica V4.1.8 fallita: ${failures.length} controllo/i.`);process.exit(1)}
console.log(`Verifica V4.1.8 completata: ${checks.length} controlli superati.`);
