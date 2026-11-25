import fs from 'node:fs';
import ts from 'typescript';

const read=path=>fs.readFileSync(path,'utf8');
const checks=[];const expect=(label,condition)=>checks.push({label,condition:Boolean(condition)});
const pkg=JSON.parse(read('package.json')),backup=read('app/api/backup/route.ts'),backupLib=read('lib/qoomia-backup.ts'),dataPage=read('app/account/dati/page.tsx'),deleteRoute=read('app/api/account/delete/route.ts'),migration=read('supabase/migrations/20261124_v4_2_backup_privacy_portability.sql'),schema=read('supabase/schema.sql'),sw=read('public/sw.js'),nav=read('components/Nav.tsx'),insights=read('lib/qoomia-insights.ts');
expect('Versione finale unica V4.2',pkg.version==='4.2.0');
expect('La suite include V4.1.9 e V4.2',pkg.scripts.test.includes('verify-v4.1.9.mjs')&&pkg.scripts.test.includes('verify-v4.2.mjs'));
expect('Backup JSON versionato',backupLib.includes("QOOMIA_BACKUP_FORMAT='qoomia-backup'")&&backupLib.includes("QOOMIA_BACKUP_VERSION='4.2'"));
expect('Backup copre dati finanziari completi',backup.includes("from('transactions')")&&backup.includes("from('categories')")&&backup.includes("from('budgets')")&&backup.includes("from('recurring_transactions')")&&backup.includes("from('saving_goals')")&&backup.includes("from('macro_budget_allocations')"));
expect('Backup tutela gli spazi condivisi non posseduti',backup.includes("reason:'member-not-owner'")&&dataPage.includes('solo membro vengono esclusi'));
expect('Download backup non memorizzabile',backup.includes("'cache-control':'no-store'")&&backup.includes("'x-content-type-options':'nosniff'"));
expect('Ripristino accetta solo owner',backup.includes("membership?.role!=='owner'")&&backup.includes('Solo l’owner'));
expect('Ripristino è merge con deduplica',backup.includes("mode:'merge'")&&backup.includes("source:'qoomia-backup'")&&backup.includes("ignoreDuplicates:true"));
expect('Limite file backup 10 MB',backupLib.includes('10*1024*1024')&&dataPage.includes('10 MB'));
expect('UI espone CSV, backup e ripristino',dataPage.includes('/api/export')&&dataPage.includes('/api/backup')&&dataPage.includes('Ripristina in modalità unione'));
expect('Eliminazione richiede email e parola ELIMINA',dataPage.includes("deleteWord!=='ELIMINA'")&&deleteRoute.includes("z.literal('ELIMINA')")&&deleteRoute.includes('user.email'));
expect('Eliminazione passa da RPC autenticata',deleteRoute.includes("rpc('delete_own_account'")&&!deleteRoute.match(/SERVICE_ROLE|service_role/i));
expect('Migration trasferisce gli spazi condivisi',migration.includes("set role='owner'")&&migration.includes('set created_by=v_successor')&&migration.includes('sharedSpacesTransferred'));
expect('Migration elimina spazio personale e utente',migration.includes("type='personal'")&&migration.includes('delete from auth.users'));
expect('Funzione di eliminazione protetta',migration.includes('security definer')&&migration.includes('revoke all on function public.delete_own_account')&&migration.includes('grant execute on function public.delete_own_account'));
expect('Schema nuove installazioni allineato',schema.includes('create or replace function public.delete_own_account'));
expect('Service Worker non mette API/backup in cache',!sw.match(/PRECACHE[^\n]*\/api\//i)&&!sw.includes('/api/backup'));
expect('V4.1.9 è inclusa integralmente',insights.includes('buildQoomiaInsights')&&fs.existsSync('components/InsightsOverview.tsx')&&read('app/statistiche/page.tsx').includes('<InsightsOverview'));
expect('Nessuna baseline Insights separata nella navigazione',!nav.match(/href:\s*['"]\/insights/));
for(const file of ['lib/qoomia-backup.ts','app/api/backup/route.ts','app/api/account/delete/route.ts','app/account/dati/page.tsx']){const source=read(file);const result=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});expect(`Sintassi ${file}`,!(result.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error))}
const failures=checks.filter(item=>!item.condition);for(const item of checks)console.log(`${item.condition?'✓':'✗'} ${item.label}`);if(failures.length){console.error(`Verifica V4.2 fallita: ${failures.length} controllo/i.`);process.exit(1)}console.log(`Verifica V4.2 completata: ${checks.length} controlli superati.`);
