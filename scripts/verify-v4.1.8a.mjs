import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const checks=[];
function expect(label,condition){checks.push({label,condition:Boolean(condition)});}

const insight=read('components/MonthlyInsightCard.tsx');
const sheet=read('components/AdaptiveSheet.tsx');
const css=read('app/globals.css');

expect('Insight categoria usa CategoryIcon',insight.includes("import CategoryIcon from './CategoryIcon'")&&insight.includes("kind:'category'")&&insight.includes('<CategoryIcon'));
expect('Insight non usa freccia di trend come icona',!insight.includes("insight.tone==='attention'?'arrowUp':'chart'"));
expect('Insight elimina CTA testuale ridondante',!insight.includes('Apri Statistiche per approfondire')&&!insight.includes('insight.detail'));
expect('Insight mantiene una sola chevron',insight.includes('monthly-insight-chevron')&&(insight.match(/monthly-insight-chevron/g)||[]).length===1);
expect('Intera card Insight resta navigabile',insight.includes('<Link href={insight.href}')&&insight.includes('aria-label={`${insight.title}. Apri il dettaglio`}'));
expect('Close sheet usa icona vettoriale X',sheet.includes("import {XIcon}")&&sheet.includes('<XIcon size={18}'));
expect('Close sheet ha geometria circolare non comprimibile',css.includes('flex:0 0 36px')&&css.includes('min-width:36px')&&css.includes('max-width:36px')&&css.includes('min-height:36px')&&css.includes('max-height:36px')&&css.includes('aspect-ratio:1/1'));
expect('Close sheet mantiene touch target esteso',css.includes('.sheet-close::before')&&css.includes('inset:-4px'));

const failures=checks.filter(item=>!item.condition);
for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);
if(failures.length){console.error(`Verifica V4.1.8a fallita: ${failures.length} controllo/i.`);process.exit(1)}
console.log(`Verifica V4.1.8a completata: ${checks.length} controlli superati.`);