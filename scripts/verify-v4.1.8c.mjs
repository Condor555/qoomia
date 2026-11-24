import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const checks=[];
function expect(label,condition){checks.push({label,condition:Boolean(condition)});}

const movements=read('app/movimenti/page.tsx');
const css=read('app/globals.css');

expect('Movimenti espone la toolbar Cerca + tre puntini',movements.includes('className="movement-search-toolbar"')&&movements.includes('className={`movement-filter-button${activeFilterCount?\' active\':\'\'}`}'));
expect('Il pulsante filtri usa la vera icona ellissi',movements.includes('<Icon name="more" size={22}/>'));
expect('I filtri Periodo/Categoria/Tipo non sono sempre visibili',!movements.includes('className="live-filter-bar"')&&!movements.includes('className="author-filter"'));
expect('I filtri vivono nello sheet dedicato',movements.includes('open={filtersOpen}')&&movements.includes('className="movement-filters-sheet"')&&movements.includes('title="Filtri"'));
expect('Periodo resta disponibile solo nella vista Lista',movements.includes("{viewMode==='list'&&<section className=\"movement-filter-group\"><h3>Periodo</h3>"));
expect('Categoria e Tipo restano collegati agli stessi stati',movements.includes('value={categoryFilter}')&&movements.includes('setCategoryFilter(value)')&&movements.includes('value={kindFilter}')&&movements.includes('setKindFilter(value)'));
expect('Il filtro autore resta disponibile quando serve',movements.includes("members.length>1&&<section className=\"movement-filter-group\"")&&movements.includes('setAuthor(member.userId)'));
expect('Il badge conta solo i filtri del menu',movements.includes('const activeFilterCount=[Boolean(periodStart||periodEnd),Boolean(author),Boolean(categoryFilter),Boolean(kindFilter)]'));
expect('I filtri attivi sono rimovibili senza riaprire lo sheet',movements.includes('className="movement-active-filters"')&&movements.includes('className="movement-reset-shortcut"'));
expect('Ricerca e filtri mantengono i parametri API esistenti',movements.includes("params.set('q',debouncedQ)")&&movements.includes("params.set('start',periodStart)")&&movements.includes("params.set('end',periodEnd)")&&movements.includes("params.set('category',categoryFilter)")&&movements.includes("params.set('kind',kindFilter)"));
expect('Le migliorie V4.1.8 restano attive',movements.includes('<SkeletonRows')&&movements.includes('<EmptyState')&&movements.includes("hapticFeedback('success')")&&movements.includes('dirty={editDirty}'));
expect('Gli stili della toolbar e dello sheet sono già nella baseline',css.includes('.movement-search-toolbar{')&&css.includes('.movement-filter-button{')&&css.includes('.movement-filter-sheet-content{')&&css.includes('.movement-active-filters{'));

const failures=checks.filter(item=>!item.condition);
for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);
if(failures.length){console.error(`Verifica V4.1.8c fallita: ${failures.length} controllo/i.`);process.exit(1)}
console.log(`Verifica V4.1.8c completata: ${checks.length} controlli superati.`);
