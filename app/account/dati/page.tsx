'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import BackToAccount from '../../../components/BackToAccount';
import Icon from '../../../components/Icon';
import SpacePicker,{type SpacePickerOption} from '../../../components/SpacePicker';
import {createClient} from '../../../lib/supabase/client';
import {isQoomiaBackup,MAX_BACKUP_BYTES,type QoomiaBackup} from '../../../lib/qoomia-backup';

type Space=SpacePickerOption&{role?:string};

export default function Dati(){
  const router=useRouter();
  const [spaces,setSpaces]=useState<Space[]>([]),[targetSpaceId,setTargetSpaceId]=useState(''),[email,setEmail]=useState('');
  const [backupFile,setBackupFile]=useState<File>(),[backup,setBackup]=useState<QoomiaBackup>(),[sourceKey,setSourceKey]=useState('');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [deleteEmail,setDeleteEmail]=useState(''),[deleteWord,setDeleteWord]=useState(''),[deleteBusy,setDeleteBusy]=useState(false),[deleteMessage,setDeleteMessage]=useState('');

  useEffect(()=>{
    Promise.all([
      fetch('/api/spaces',{cache:'no-store'}).then(async response=>({ok:response.ok,result:await response.json()})),
      fetch('/api/settings/profile',{cache:'no-store'}).then(async response=>({ok:response.ok,result:await response.json()})),
    ]).then(([spaceResult,profileResult])=>{
      if(spaceResult.ok){const list:Space[]=spaceResult.result.data||[];setSpaces(list);const owner=list.find(space=>space.role==='owner')||list[0];setTargetSpaceId(spaceResult.result.activeSpaceId&&list.some(space=>space.id===spaceResult.result.activeSpaceId&&space.role==='owner')?spaceResult.result.activeSpaceId:owner?.id||'')}
      if(profileResult.ok)setEmail(profileResult.result.data.email||'');
    }).catch(()=>setMessage('Impossibile caricare i dati dell’account.')).finally(()=>setLoading(false));
  },[]);

  const ownedSpaces=useMemo(()=>spaces.filter(space=>space.role==='owner'),[spaces]);
  async function chooseBackupFile(file?:File){
    setBackupFile(file);setBackup(undefined);setSourceKey('');setMessage('');
    if(!file)return;
    if(file.size>MAX_BACKUP_BYTES){setMessage('Il backup supera il limite di 10 MB.');return}
    try{const parsed:unknown=JSON.parse(await file.text());if(!isQoomiaBackup(parsed)){setMessage('Backup Qoomia non riconosciuto o versione non supportata.');return}setBackup(parsed);setSourceKey(parsed.spaces[0]?.key||'');setMessage(`Backup del ${new Intl.DateTimeFormat('it-IT',{dateStyle:'medium',timeStyle:'short'}).format(new Date(parsed.exportedAt))}: ${parsed.spaces.length} spazi disponibili.`)}catch{setMessage('Il file selezionato non è un JSON valido.')}
  }

  async function restore(){
    if(!backupFile||!backup||!sourceKey||!targetSpaceId){setMessage('Seleziona backup, spazio origine e destinazione.');return}
    setBusy(true);setMessage('Ripristino in corso…');
    try{const form=new FormData();form.set('file',backupFile);form.set('source_key',sourceKey);form.set('target_space_id',targetSpaceId);const response=await fetch('/api/backup',{method:'POST',body:form});const result=await response.json();if(!response.ok){setMessage(result.error||'Ripristino non riuscito.');return}const count=Object.values(result.data||{}).filter(value=>typeof value==='number').reduce((sum,value)=>sum+Number(value),0);setMessage(`Ripristino completato in modalità unione. ${count} elementi elaborati; i duplicati riconosciuti non sono stati ricreati.`)}catch{setMessage('Errore di connessione durante il ripristino.')}finally{setBusy(false)}
  }

  async function deleteAccount(){
    if(deleteWord!=='ELIMINA'||deleteEmail.trim().toLocaleLowerCase()!==email.toLocaleLowerCase())return;
    setDeleteBusy(true);setDeleteMessage('Eliminazione in corso…');
    try{const response=await fetch('/api/account/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmation:deleteWord,email:deleteEmail})});const result=await response.json();if(!response.ok){setDeleteMessage(result.error||'Impossibile eliminare l’account.');return}await createClient().auth.signOut({scope:'local'});router.replace('/login?account=deleted');router.refresh()}catch{setDeleteMessage('Errore di connessione. L’account non è stato eliminato.')}finally{setDeleteBusy(false)}
  }

  return <>
    <BackToAccount/>
    <header className="page-head"><div><h1>Dati e privacy</h1><p>Backup, portabilità e controllo dell’account</p></div></header>

    <section className="settings-card surface data-section-card">
      <div className="data-section-title"><span><Icon name="download"/></span><div><h2>Esporta e importa CSV</h2><p>Compatibilità semplice per i soli movimenti.</p></div></div>
      <div className="data-action-list">
        <Link className="settings-link" href="/importa"><span><Icon name="download"/></span><div><b>Importa movimenti CSV</b><small>Formato italiano/inglese e Money Lover</small></div><strong>›</strong></Link>
        <a className="settings-link" href="/api/export"><span><Icon name="upload"/></span><div><b>Esporta movimenti CSV</b><small>File leggibile da fogli di calcolo</small></div><strong>›</strong></a>
      </div>
    </section>

    <section className="settings-card surface data-section-card">
      <div className="data-section-title"><span><Icon name="wallet"/></span><div><h2>Backup completo Qoomia</h2><p>Movimenti, categorie, Budget, ricorrenze e obiettivi.</p></div></div>
      <a className="save-btn data-download-button" href="/api/backup" download><Icon name="download" size={18}/> Scarica backup JSON</a>
      <p className="settings-help">Il backup include gli spazi personali e quelli condivisi di cui sei owner. Gli spazi condivisi in cui sei solo membro vengono esclusi per proteggere i dati degli altri.</p>
    </section>

    <section className="settings-card surface data-section-card restore-card">
      <div className="data-section-title"><span><Icon name="repeat"/></span><div><h2>Ripristina un backup</h2><p>Unione sicura nello spazio scelto, senza cancellare i dati presenti.</p></div></div>
      <label className="picker-label" htmlFor="backup-file">File Qoomia JSON</label>
      <input id="backup-file" className="import-file-input" type="file" accept=".json,application/json" disabled={busy} onChange={event=>void chooseBackupFile(event.target.files?.[0])}/>
      {backup&&<>
        <label className="picker-label" htmlFor="backup-source">Spazio nel backup</label>
        <select id="backup-source" value={sourceKey} onChange={event=>setSourceKey(event.target.value)} disabled={busy}>{backup.spaces.map(space=><option key={space.key} value={space.key}>{space.name} · {space.type==='personal'?'Personale':'Condiviso'}</option>)}</select>
        <SpacePicker spaces={ownedSpaces} value={targetSpaceId} onChange={setTargetSpaceId} variant="destination" label="Spazio di destinazione" help="Solo gli owner possono ripristinare. Le chiavi del backup impediscono di duplicare gli stessi movimenti." disabled={busy||loading}/>
      </>}
      <button className="save-btn" disabled={busy||!backup||!sourceKey||!targetSpaceId} onClick={()=>void restore()}>{busy?'Ripristino…':'Ripristina in modalità unione'}</button>
      {message&&<div className="notice" role="status">{message}</div>}
    </section>

    <section className="data-tip surface"><Icon name="settings"/><div><b>Privacy per progettazione</b><p>Il file viene generato su richiesta e non viene inserito nella cache offline. Il ripristino accetta solo backup Qoomia V4.2 fino a 10 MB.</p></div></section>

    <details className="settings-card surface data-danger-zone">
      <summary><span><Icon name="logout"/></span><div><b>Elimina account e dati</b><small>Azione definitiva con protezione degli spazi condivisi</small></div><strong>⌄</strong></summary>
      <div className="data-danger-content">
        <p>Lo spazio personale e i dati attribuiti al tuo account verranno eliminati. Se possiedi uno spazio condiviso con altri membri, la proprietà passa a un membro esistente; se non ci sono altri membri, lo spazio viene eliminato.</p>
        <p><b>Scarica prima un backup completo.</b> Questa operazione non può essere annullata.</p>
        <label className="picker-label" htmlFor="delete-email">Conferma email</label>
        <input id="delete-email" type="email" autoComplete="email" value={deleteEmail} onChange={event=>setDeleteEmail(event.target.value)} placeholder={email||'email account'}/>
        <label className="picker-label" htmlFor="delete-word">Scrivi ELIMINA</label>
        <input id="delete-word" value={deleteWord} onChange={event=>setDeleteWord(event.target.value.toLocaleUpperCase())} autoComplete="off" placeholder="ELIMINA"/>
        <button className="danger data-delete-button" disabled={deleteBusy||deleteWord!=='ELIMINA'||deleteEmail.trim().toLocaleLowerCase()!==email.toLocaleLowerCase()} onClick={()=>void deleteAccount()}>{deleteBusy?'Eliminazione…':'Elimina definitivamente account'}</button>
        {deleteMessage&&<div className="auth-error" role="alert">{deleteMessage}</div>}
      </div>
    </details>
  </>;
}
