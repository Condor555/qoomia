import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const checks=[];
const assert=(condition,message)=>{if(!condition)throw new Error(`V4.3.3 performance: ${message}`);checks.push(message)};

const home=read('app/page.tsx');
const stats=read('app/api/stats/route.ts');
const macro=read('lib/macro-budget.ts');
const nav=read('components/Nav.tsx');
const spaces=read('components/SpaceSwitcher.tsx');
const composer=read('components/NewTransactionComposer.tsx');
const picker=read('components/CategoryPickerSheet.tsx');
const cache=read('lib/client-json-cache.ts');
const pkg=JSON.parse(read('package.json'));

assert(pkg.version==='4.3.3','versione applicativa aggiornata');
assert(home.includes('recentTransactions:RecentTransaction[]'),'Home riceve i movimenti recenti dalla risposta aggregata');
assert(!home.includes('/api/transactions?page=1&size=5'),'Home non esegue più la richiesta movimenti separata');
assert(!home.includes('/api/categories'),'Home non esegue più la richiesta categorie separata');
assert(stats.includes('sharedBudgetRows'),'Statistiche condivide i dataset con il motore budget');
assert(stats.includes('recentTransactions'),'Statistiche restituisce il payload Home aggregato');
assert(!stats.includes('loadSavingGoals'),'Statistiche non carica obiettivi non visualizzati');
assert(stats.includes('Promise.resolve(sb.from(\'transactions\')'),'le query Supabase condivise vengono materializzate una sola volta');
assert(macro.includes('MacroBudgetPreloaded'),'il motore budget supporta dataset precaricati');
assert(macro.includes('preloaded?Promise.resolve(preloaded)'),'il fallback del motore budget resta compatibile');
assert(nav.includes('onTouchStart={()=>warmRoute(tab.href)}'),'navigazione mobile con prefetch dati su intenzione');
assert(nav.includes("cachedJson('/api/transactions?page=1&size=30')"),'Movimenti viene preriscaldato con la chiave cache corretta');
assert(spaces.includes("cachedJson<{data?:Space[];activeSpaceId?:string}>('/api/spaces'")&&!spaces.includes('usePathname'),'il selettore spazio non ricarica a ogni navigazione');
assert(spaces.includes('announcedRef.current!==initialSpaceId'),'gli eventi spazio duplicati sono soppressi');
assert(composer.includes("cachedJson<{data?:Space[];activeSpaceId?:string}>('/api/spaces')"),'il composer riusa la cache degli spazi');
assert(picker.includes('cachedJson<Usage>'),'l’uso categorie viene riutilizzato tra aperture');
assert(cache.includes('existing?.inflight'),'deduplicazione richieste concorrenti attiva');

console.log(`V4.3.3 performance: ${checks.length}/${checks.length} controlli superati.`);