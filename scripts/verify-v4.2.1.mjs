import fs from 'node:fs';
import ts from 'typescript';

const read=path=>fs.readFileSync(path,'utf8');
const checks=[];const expect=(label,condition)=>checks.push({label,condition:Boolean(condition)});
const pkg=JSON.parse(read('package.json'));
const dataPage=read('app/account/dati/page.tsx');
const css=read('app/globals.css');
const icon=read('components/Icon.tsx');
const catalog=read('lib/category-icon-catalog.ts');
const style=read('lib/category-style.ts');
const info=read('app/account/informazioni/page.tsx');
const provenance=JSON.parse(read('public/icons/icon-provenance.json'));

expect('Versione V4.2.1',pkg.version==='4.2.1'&&pkg.scripts.test.includes('verify-v4.2.1.mjs'));
expect('Movimenti CSV usa doppia freccia',dataPage.includes('data-hub-transfer-icon')&&dataPage.includes('<Icon name="upload" size={16}/><Icon name="download" size={16}/>')&&css.includes('.data-hub-transfer-icon{'));
expect('Descrizione CSV aggiornata',dataPage.includes('Importa ed esporta i tuoi movimenti')&&!dataPage.includes('Importa o scarica i movimenti'));
expect('Azioni CSV mostrano direzioni corrette',dataPage.includes('<b>Importa da CSV</b>')&&dataPage.includes('aria-hidden="true">↓</strong></Link>')&&dataPage.includes('<b>Esporta in CSV</b>')&&dataPage.includes('aria-hidden="true">↑</strong></a>'));
expect('Backup non usa icona Budget',dataPage.includes('<Icon name="backup"/>')&&!dataPage.includes('<Icon name="wallet"/></span><span><b>Backup Qoomia</b>')&&icon.includes("|'backup'|")&&icon.includes('backup:<><path'));
expect('Istruzione X ridondante rimossa',!dataPage.includes('Al termine puoi chiudere questa schermata con la X in alto.'));
expect('Barbiere ha icona Icons8 dedicata',catalog.includes("icons8('barber','Barbiere','Scissors and comb'")&&catalog.includes('scissors-and-comb.png')&&style.includes("style:color('barber','#E39C34')"));
expect('Divertimento non riusa Cinema',catalog.includes("icons8('entertainment','Divertimento','Confetti'")&&catalog.includes('/confetti.png')&&style.includes("style:color('entertainment','#F17D45')")&&!style.includes("/divertimento|evento/i,style:color('cinema'"));
expect('Categorie storiche vengono rimappate',style.includes("['shopping','tag'].includes(normalizedCustom)")&&style.includes("['cinema','tag'].includes(normalizedCustom)"));
expect('Attribuzione Icons8 aggiornata',info.includes('Barbiere e Divertimento distribuite dal CDN Icons8')&&provenance.runtimeExternalIconCalls===true&&provenance.approvedRuntimeAssets?.barber&&provenance.approvedRuntimeAssets?.entertainment);

for(const file of ['app/account/dati/page.tsx','components/Icon.tsx','lib/category-icon-catalog.ts','lib/category-style.ts']){
  const source=read(file);const result=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  expect(`Sintassi ${file}`,!(result.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error));
}

const failures=checks.filter(item=>!item.condition);
for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);
if(failures.length){console.error(`Verifica V4.2.1 fallita: ${failures.length} controllo/i.`);process.exit(1)}
console.log(`Verifica V4.2.1 completata: ${checks.length} controlli superati.`);