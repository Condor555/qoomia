import fs from 'node:fs';
import ts from 'typescript';

const read=path=>fs.readFileSync(path,'utf8');
const exists=path=>fs.existsSync(path)&&fs.statSync(path).size>0;
const checks=[];const expect=(label,condition)=>checks.push({label,condition:Boolean(condition)});
const pkg=JSON.parse(read('package.json'));
const catalog=read('lib/category-icon-catalog.ts');
const style=read('lib/category-style.ts');
const assets=read('lib/category-icon-assets.ts');
const info=read('app/account/informazioni/page.tsx');
const provenance=JSON.parse(read('public/icons/icon-provenance.json'));

expect('Versione V4.2.2',(pkg.version==='4.2.2'||pkg.version.startsWith('4.3.'))&&pkg.scripts.test.includes('verify-v4.2.2.mjs')&&pkg.scripts['audit:icons'].includes('v4.2.2'));
expect('Barbiere usa asset locale specifico',catalog.includes("icon('barber','Barbiere','Scissors and comb'")&&exists('public/icons/categories/barber.png'));
expect('Educazione usa cappello universitario locale',catalog.includes("icon('education','Educazione','Graduation cap'")&&style.includes("style:color('education','#438FDF')")&&exists('public/icons/categories/education.png'));
expect('Divertimento resta distinto e locale',catalog.includes("icon('entertainment','Divertimento','Confetti'")&&exists('public/icons/categories/entertainment.png'));
expect('Nessuna icona categoria dipende dal CDN',!catalog.includes("icons8('")&&!catalog.includes('https://img.icons8.com/')&&assets.includes('asset locali'));
expect('Categorie storiche rimappate',style.includes("/barbiere|parrucchiere/i.test(name)&&['shopping','tag'].includes(normalizedCustom)")&&style.includes("/scuola|universit|educazione|formazione/i.test(name)&&['books','tag'].includes(normalizedCustom)"));
expect('Alias educazione completi',catalog.includes("'graduation-cap':'education'")&&catalog.includes("'school':'education'")&&catalog.includes("'university':'education'"));
expect('Suggerimenti educazione completi',catalog.includes("/scuola|universit|educazione|formazione|studio/i,['education']"));
expect('Provenienza locale coerente',provenance.version==='4.2.2'&&provenance.runtimeExternalIconCalls===false&&Object.keys(provenance.approvedRuntimeAssets||{}).length===0);
expect('Informazioni aggiornate',/Versione 4\.(?:2\.2|3\.\d+)/.test(info)&&info.includes('Barbiere, Educazione e Divertimento hanno icone dedicate incluse nell’app'));

for(const file of ['app/account/informazioni/page.tsx','lib/category-icon-assets.ts','lib/category-icon-catalog.ts','lib/category-style.ts']){
  const source=read(file);const result=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  expect(`Sintassi ${file}`,!(result.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error));
}

const failures=checks.filter(item=>!item.condition);
for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);
if(failures.length){console.error(`Verifica V4.2.2 fallita: ${failures.length} controllo/i.`);process.exit(1)}
console.log(`Verifica V4.2.2 completata: ${checks.length} controlli superati.`);