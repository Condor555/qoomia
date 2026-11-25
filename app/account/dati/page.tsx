'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import AdaptiveSheet from '../../../components/AdaptiveSheet';
import BackToAccount from '../../../components/BackToAccount';
import Icon from '../../../components/Icon';
import SpacePicker,{type SpacePickerOption} from '../../../components/SpacePicker';
import {createClient} from '../../../lib/supabase/client';
import {isQoomiaBackup,MAX_BACKUP_BYTES,type QoomiaBackup} from '../../../lib/qoomia-backup';

type Space=SpacePickerOption&{role?:string};
type DataSheet='csv'|'backup'|'delete'|null;

export default function Dati(){
  const router=useRouter();
  const [activeSheet,setActiveSheet]=useState<DataSheet>(null);
  const [spaces,setSpaces]=useState<Space[]>([]),[targetSpaceId,setTargetSpaceId]=useState(''),[email,setEmail]=useState('');
  const [backupFile,setBackupFile]=useState<File>(),[backup,setBackup]=useState<QoomiaBackup>(),[sourceKey,setSourceKey]=useState('');
  const [backupMessage,setBackupMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[pageMessage,setPageMessage]=useState('');
  const [deleteEmail,setDeleteEmail]=useState(''),[deleteWord,setDeleteWord]=useState(''),[deleteBusy,setDeleteBusy]=useState(false),[deleteMessage,setDeleteMessage]=useState('');

  useEffect(()=>{
    Promise.all([
      fetch('/api/spaces',{cache:'no-store'}).then(async response=>({ok:response.ok,result:await response.json()})),
      fetch('/api/settings/profile',{cache:'no-store'}).then(async response=>({ok:response.ok,result:await response.json()})),
    ]).then(([spaceResult,profileResult])=>{
      if(spaceResult.ok){const list:Space[]=spaceResult.result.data||[];setSpaces(list);const owner=list.find(space=>space.role==='owner')||list[0];setTargetSpaceId(spaceResult.result.activeSpaceId&&list.some(space=>space.id===spaceResult.result.activeSpaceId&&space.role==='owner')?spaceResult.result.activeSpaceId:owner?.id||'')}
      else setPageMessage(spaceResult.result.error||'Impossibile caricare gli spazi.');
      if(profileResult.ok)setEmail(profileResult.result.data.email||'');
      else setPageMessage(profileResult.result.error||'Impossibile caricare l’account.');
    }).catch(()=>setPageMessage('Impossibile caricare i dati dell’account.')).finally(()=>setLoading(false));
  },[]);

  const ownedSpaces=useMemo(()=>spaces.filter(space=>space.role==='owner'),[spaces]);

  async function chooseBackupFile(file?:File){
    setBackupFile(file);setBackup(undefined);setSourceKey('');setBackupMessage('');
    if(!file)return;
    if(file.size>MAX_BACKUP_BYTES){setBackupMessage('Il file supera il limite di 10 MB.');return}
    try{
      const parsed:unknown=JSON.parse(await file.text());
      if(!isQoomiaBackup(parsed)){setBackupMessage('Questa copia non è compatibile con Qoomia V4.2.');return}
      setBackup(parsed);setSourceKey(parsed.spaces[0]?.key||'');
      setBackupMessage(`Copia del ${new Intl.DateTimeFormat('it-IT',{dateStyle:'medium',timeStyle:'short'}).format(new Date(parsed.exportedAt))}: ${parsed.spaces.length} spazi disponibili.`);
    }catch{setBackupMessage('Il file selezionato non è valido.')}
  }

  async function recoverData(){
    if(!backupFile||!backup||!sourceKey||!targetSpaceId){setBackupMessage('Seleziona il file, lo spazio nella copia e lo spazio di destinazione.');return}
    setBusy(true);setBackupMessage('Recupero dei dati in corso…');
    try{
      const form=new FormData();form.set('file',backupFile);form.set('source_key',sourceKey);form.set('target_space_id',targetSpaceId);
      const response=await fetch('/api/backup',{method:'POST',body:form});const result=await response.json();
      if(!response.ok){setBackupMessage(result.error||'Non è stato possibile recuperare i dati.');return}
      const count=Object.values(result.data||{}).filter(value=>typeof value==='number').reduce((sum,value)=>sum+Number(value),0);
      setBackupMessage(`Dati recuperati: ${count} elementi elaborati. Quelli già riconosciuti non sono stati duplicati.`);
    }catch{setBackupMessage('Errore di connessione durante il recupero dei dati.')}finally{setBusy(false)}
  }

  async function deleteAccount(){
    if(deleteWord!=='ELIMINA'||deleteEmail.trim().toLocaleLowerCase()!==email.toLocaleLowerCase())return;
    setDeleteBusy(true);setDeleteMessage('Eliminazione in corso…');
    try{
      const response=await fetch('/api/account/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmation:deleteWord,email:deleteEmail})});
      const result=await response.json();if(!response.ok){setDeleteMessage(result.error||'Impossibile eliminare l’account.');return}
      await createClient().auth.signOut({scope:'local'});router.replace('/login?account=deleted');router.refresh();
    }catch{setDeleteMessage('Errore di connessione. L’account non è stato eliminato.')}finally{setDeleteBusy(false)}
  }

  return <>
    <BackToAccount/>
    <header className="page-head"><div><h1>Dati e privacy</h1><p>Esporta, proteggi o elimina i tuoi dati</p></div></header>

    <section className="surface data-hub" aria-label="Gestione dati">
      <button type="button" className="data-hub-row" onClick={()=>setActiveSheet('csv')}>
        <span className="data-hub-icon data-hub-transfer-icon"><Icon name="upload" size={16}/><Icon name="download" size={16}/></span><span><b>Movimenti CSV</b><small>Importa ed esporta i tuoi movimenti</small></span><strong aria-hidden="true">›</strong>
      </button>
      <button type="button" className="data-hub-row" onClick={()=>setActiveSheet('backup')}>
        <span className="data-hub-icon"><Icon name="backup"/></span><span><b>Backup Qoomia</b><small>Scarica una copia o recupera i dati</small></span><strong aria-hidden="true">›</strong>
      </button>
      <button type="button" className="data-hub-row danger-row" onClick={()=>setActiveSheet('delete')}>
        <span className="data-hub-icon"><Icon name="logout"/></span><span><b>Elimina account e dati</b><small>Azione definitiva protetta da conferma</small></span><strong aria-hidden="true">›</strong>
      </button>
    </section>

    <p className="data-privacy-note"><Icon name="settings" size={17}/><span>I file vengono creati solo quando li richiedi e non sono salvati nella cache offline.</span></p>
    {pageMessage&&<div className="notice" role="status">{pageMessage}</div>}

    <AdaptiveSheet open={activeSheet==='csv'} onClose={()=>setActiveSheet(null)} title="Movimenti CSV" eyebrow="Dati e privacy" size="compact" className="data-tool-sheet" showGrabber>
      <div className="data-sheet-intro"><p>Usa il formato CSV per spostare i soli movimenti tra Qoomia, Money Lover e un foglio di calcolo.</p></div>
      <div className="data-sheet-actions">
        <Link className="data-sheet-action" href="/importa"><span><Icon name="download"/></span><div><b>Importa da CSV</b><small>Aggiungi movimenti da un file compatibile</small></div><strong aria-hidden="true">↓</strong></Link>
        <a className="data-sheet-action" href="/api/export" download><span><Icon name="upload"/></span><div><b>Esporta in CSV</b><small>Scarica i movimenti in un file leggibile</small></div><strong aria-hidden="true">↑</strong></a>
      </div>
    </AdaptiveSheet>

    <AdaptiveSheet open={activeSheet==='backup'} onClose={()=>setActiveSheet(null)} title="Backup Qoomia" eyebrow="Dati e privacy" size="large" busy={busy} className="data-tool-sheet backup-tool-sheet" showGrabber>
      <section className="data-sheet-section">
        <h3>Salva una copia completa</h3>
        <p>Comprende movimenti, categorie, Budget, ricorrenze e obiettivi degli spazi di cui sei owner.</p>
        <a className="save-btn data-sheet-download" href="/api/backup" download><Icon name="download" size={18}/> Scarica copia di sicurezza</a>
      </section>
      <section className="data-sheet-section data-recovery-section">
        <h3>Recupera i dati da una copia</h3>
        <p>I dati che mancano vengono aggiunti allo spazio scelto. Quelli già presenti non vengono cancellati e i movimenti riconosciuti non vengono duplicati.</p>
        <label className="picker-label" htmlFor="backup-file">Copia Qoomia</label>
        <input id="backup-file" className="import-file-input" type="file" accept=".json,application/json" disabled={busy} onChange={event=>void chooseBackupFile(event.target.files?.[0])}/>
        {backup&&<>
          <label className="picker-label" htmlFor="backup-source">Dati da recuperare</label>
          <select id="backup-source" value={sourceKey} onChange={event=>setSourceKey(event.target.value)} disabled={busy}>{backup.spaces.map(space=><option key={space.key} value={space.key}>{space.name} · {space.type==='personal'?'Personale':'Condiviso'}</option>)}</select>
          <SpacePicker spaces={ownedSpaces} value={targetSpaceId} onChange={setTargetSpaceId} variant="destination" label="Aggiungi nello spazio" help="Per proteggere gli altri membri, puoi scegliere solo uno spazio di cui sei owner." disabled={busy||loading}/>
        </>}
        <button className="save-btn" disabled={busy||!backup||!sourceKey||!targetSpaceId} onClick={()=>void recoverData()}>{busy?'Recupero…':'Recupera i dati'}</button>
        {backupMessage&&<div className="notice" role="status">{backupMessage}</div>}
      </section>
    </AdaptiveSheet>

    <AdaptiveSheet open={activeSheet==='delete'} onClose={()=>setActiveSheet(null)} title="Elimina account" eyebrow="Dati e privacy" size="medium" busy={deleteBusy} className="data-tool-sheet delete-account-sheet" showGrabber>
      <div className="data-sheet-intro danger-intro"><p>Lo spazio personale e i dati attribuiti al tuo account verranno eliminati. Gli spazi condivisi con altri membri passeranno a un membro esistente.</p><p><b>Scarica prima una copia di sicurezza.</b> L’operazione non può essere annullata.</p></div>
      <label className="picker-label" htmlFor="delete-email">Conferma la tua email</label>
      <input id="delete-email" type="email" autoComplete="email" value={deleteEmail} onChange={event=>setDeleteEmail(event.target.value)} placeholder={email||'email account'}/>
      <label className="picker-label" htmlFor="delete-word">Scrivi ELIMINA</label>
      <input id="delete-word" value={deleteWord} onChange={event=>setDeleteWord(event.target.value.toLocaleUpperCase())} autoComplete="off" placeholder="ELIMINA"/>
      <button className="danger data-delete-button" disabled={deleteBusy||deleteWord!=='ELIMINA'||deleteEmail.trim().toLocaleLowerCase()!==email.toLocaleLowerCase()} onClick={()=>void deleteAccount()}>{deleteBusy?'Eliminazione…':'Elimina definitivamente account'}</button>
      {deleteMessage&&<div className="auth-error" role="alert">{deleteMessage}</div>}
    </AdaptiveSheet>
  </>;
}
