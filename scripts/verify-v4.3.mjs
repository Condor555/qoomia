import fs from 'node:fs';
import ts from 'typescript';

const read=path=>fs.readFileSync(path,'utf8');
const checks=[];const expect=(label,condition)=>checks.push({label,condition:Boolean(condition)});
const pkg=JSON.parse(read('package.json'));
const home=read('app/page.tsx');
const layout=read('app/layout.tsx');
const css=read('app/globals.css');
const nav=read('components/Nav.tsx');
const header=read('components/AppHeader.tsx');
const composer=read('components/NewTransactionComposer.tsx');

expect('Versione applicativa V4.3',pkg.version==='4.3.0'&&pkg.scripts.test.includes('verify-v4.3.mjs'));
expect('Phosphor riusato senza dipendenze duplicate',pkg.dependencies['@phosphor-icons/react']==='^2.1.10');
expect('Home collegata ai dati reali',home.includes("cachedJson<Stats")&&home.includes('/api/stats')&&home.includes('/api/transactions')&&home.includes('onActiveSpaceChanged'));
expect('Home senza dataset finanziario dimostrativo Figma',!home.includes('Esselunga')&&!home.includes('Marco Costa')&&!home.includes("useState<'verde' | 'indaco'>"));
expect('Personale/Famiglia preservato nello shell',header.includes('<SpaceSwitcher/>')&&layout.includes('<AppHeader/>'));
expect('Tema persistente e internazionalizzazione preservati',layout.includes('<ThemeProvider/>')&&layout.includes('<LanguageProvider>'));
expect('PWA e composer reali preservati',layout.includes('<PwaInstallPrompt/>')&&layout.includes('<FloatingAddMovement/>')&&composer.includes("fetch('/api/transactions'"));
expect('Navigazione reale Next.js',['/movimenti','/budget','/statistiche','/account'].every(path=>nav.includes(`href: '${path}'`)||nav.includes(`href:'${path}'`)));
expect('Sidebar desktop e bottom navigation mobile',css.includes('@media(min-width:861px)')&&css.includes('.nav-brand-lockup')&&css.includes('@media(max-width:860px)'));
expect('Dashboard usa griglie Figma con contenuti reali',home.includes('home-hero-grid')&&home.includes('home-dashboard-grid')&&css.includes('.home-hero-grid')&&css.includes('.home-dashboard-grid'));
expect('Nessun font remoto aggiunto',!css.includes("fonts.googleapis.com"));
expect('Nessuna copia degli asset demo Figma',!fs.existsSync('public/qoomia/logo.svg')&&!fs.existsSync('src/App.tsx'));

for(const file of ['app/page.tsx','components/Nav.tsx','components/AppHeader.tsx','app/layout.tsx']){
  const source=read(file);const result=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  expect(`Sintassi ${file}`,!(result.diagnostics||[]).some(item=>item.category===ts.DiagnosticCategory.Error));
}

const failures=checks.filter(item=>!item.condition);
for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);
if(failures.length){console.error(`Verifica V4.3 fallita: ${failures.length} controllo/i.`);process.exit(1)}
console.log(`Verifica V4.3 completata: ${checks.length} controlli superati.`);
