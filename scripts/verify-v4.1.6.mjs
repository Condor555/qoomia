import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import ts from 'typescript';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const transpile=async path=>{
  const source=await read(path);
  const result=ts.transpileModule(source,{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX},
    reportDiagnostics:true,
    fileName:path,
  });
  const errors=(result.diagnostics||[]).filter(item=>item.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,`${path}: ${errors.map(item=>ts.flattenDiagnosticMessageText(item.messageText,' ')).join('; ')}`);
  return source;
};

const [layout,toast,composer,standalone,modal,nav,fab,movements,pkgText,lockText,migration,i18n,iconCatalog]=await Promise.all([
  'app/layout.tsx',
  'components/ToastProvider.tsx',
  'components/NewTransactionComposer.tsx',
  'app/nuovo/page.tsx',
  'app/@modal/(.)nuovo/page.tsx',
  'components/Nav.tsx',
  'components/FloatingAddMovement.tsx',
  'app/movimenti/page.tsx',
  'package.json',
  'package-lock.json',
  'supabase/migrations/20261123_v4_1_4_performance.sql',
  'lib/i18n.ts',
  'lib/category-icon-catalog.ts',
].map(read));

assert(layout.includes("import ToastProvider from '../components/ToastProvider'"),'Il layout deve importare ToastProvider.');
assert(layout.includes('function Layout({children,modal}')&&layout.includes('{modal}</ToastProvider>'),'Il layout deve renderizzare lo slot modale dentro ToastProvider.');
assert(layout.indexOf('<ToastProvider>')<layout.indexOf('{children}')&&layout.indexOf('{children}')<layout.indexOf('</ToastProvider>'),'Le pagine devono essere avvolte da ToastProvider.');
assert(layout.includes('<FloatingAddMovement/>')&&layout.includes('<Nav/>'),'FAB e navigazione devono restare nel layout condiviso.');
assert(toast.includes('const ToastContext=createContext')&&toast.includes('export function useToast()'),'ToastProvider deve esporre il contesto e useToast.');
assert(composer.includes('const {showToast}=useToast()')&&composer.includes("showToast({message:t('new.saved')"),'Nuovo movimento deve usare il toast dopo il salvataggio.');
assert(standalone.includes('<NewTransactionComposer/>'),'La route /nuovo deve usare il composer condiviso.');
assert(modal.includes('<AdaptiveSheet open')&&modal.includes('<NewTransactionComposer embedded'),'La route intercettata deve usare AdaptiveSheet e il composer condiviso.');
assert(nav.includes("href: '/budget'")&&nav.includes("label: 'nav.budget'"),'Budget deve essere una destinazione principale.');
assert(fab.includes('const COLLAPSE_AT=96')&&fab.includes("new Set(['/','/movimenti'])")&&fab.includes('is-collapsed'),'Il FAB deve comprimersi allo scroll in Home e Movimenti.');
for(const token of ["type ViewMode='list'|'calendar'","viewMode==='calendar'",'calendarMonth','selectedDay'])assert(movements.includes(token),`Vista calendario: manca ${token}`);
assert(migration.includes('create index if not exists'),'La migration performance V4.1.4 deve essere inclusa.');

const pkg=JSON.parse(pkgText);
const lock=JSON.parse(lockText);
assert(['4.1.8','4.1.9','4.2.0'].includes(pkg.version),'Versione applicativa non supportata dalla suite cumulativa.');
assert.equal(lock.version,pkg.version);
assert.equal(lock.packages[''].version,pkg.version);
assert(pkg.devDependencies?.['@types/react-dom'],'@types/react-dom deve essere presente nelle devDependencies.');
assert(lock.packages?.['node_modules/@types/react-dom'],'@types/react-dom deve essere presente nel lockfile.');
for(const requiredCheck of ['verify-v4.1.6.mjs','verify-v4.1.8.mjs','verify-v4.1.8a.mjs']){
  assert(pkg.scripts.test.includes(requiredCheck),`Lo script test deve includere ${requiredCheck}.`);
}

const i18nResult=ts.transpileModule(i18n,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022},reportDiagnostics:true,fileName:'lib/i18n.ts'});
assert.equal((i18nResult.diagnostics||[]).filter(item=>item.category===ts.DiagnosticCategory.Error).length,0,'lib/i18n.ts contiene errori sintattici.');
const runtime=await import(`data:text/javascript;base64,${Buffer.from(i18nResult.outputText).toString('base64')}`);
assert.deepEqual(Object.keys(runtime.messages.en).sort(),Object.keys(runtime.messages.it).sort(),'I dizionari IT/EN devono avere le stesse chiavi.');

for(const id of ['beach-umbrella','wedding','couple']){
  assert(iconCatalog.includes(`icon('${id}'`),`Catalogo icone: manca ${id}.`);
  assert((await stat(new URL(`public/icons/categories/${id}.png`,root))).isFile(),`Asset icona mancante: ${id}.png`);
}

const sourceFiles=[];
async function collect(directory){
  for(const entry of await readdir(new URL(directory,root),{withFileTypes:true})){
    const relative=`${directory}${entry.name}`;
    if(entry.isDirectory())await collect(`${relative}/`);
    else if(/\.(ts|tsx)$/.test(entry.name))sourceFiles.push(relative);
  }
}
for(const directory of ['app/','components/','lib/'])await collect(directory);
for(const file of sourceFiles)await transpile(file);

console.log(`verify-v4.1.6: provider globale, route /nuovo, FAB, calendario, dipendenze, asset e ${sourceFiles.length} file TS/TSX verificati`);
