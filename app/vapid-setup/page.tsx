'use client';
import {useState} from 'react';

type GeneratedKeys={publicKey:string;privateKey:string;generatedAt:string;warning:string};
export default function TemporaryVapidSetup(){
  const [token,setToken]=useState('');
  const [keys,setKeys]=useState<GeneratedKeys|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function generate(){
    if(keys||busy)return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/admin/vapid-generator',{method:'POST',cache:'no-store',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({confirm:'GENERATE_QOOMIA_VAPID_ONCE'})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Generazione non riuscita.');
      setKeys(result);setToken('');
    }catch(reason){setError(reason instanceof Error?reason.message:'Generazione non riuscita.')}finally{setBusy(false)}
  }
  async function copy(value:string){await navigator.clipboard.writeText(value)}
  return <>
    <header className="page-head"><div><h1>Generatore VAPID temporaneo</h1><p>Usalo una sola volta, poi rimuovilo completamente.</p></div></header>
    <section className="section surface">
      <div className="notice"><b>Sicurezza</b><p>Questa pagina richiede sia l’accesso a Qoomia sia il token temporaneo configurato in Vercel. La risposta non viene memorizzata dall’app. Non ricaricare né premere di nuovo dopo la generazione: una nuova chiamata produrrebbe chiavi diverse.</p></div>
      {!keys&&<><label><b>VAPID_GENERATOR_TOKEN</b><input type="password" value={token} autoComplete="off" spellCheck={false} onChange={event=>setToken(event.target.value)} placeholder="Incolla il token temporaneo"/></label><button type="button" disabled={busy||token.length<48} onClick={generate}>{busy?'Generazione…':'Genera una sola coppia VAPID'}</button></>}
      {error&&<div className="notice" role="alert">{error}</div>}
      {keys&&<div>
        <div className="notice"><b>Coppia generata</b><p>{keys.warning}</p><small>{keys.generatedAt}</small></div>
        <label><b>NEXT_PUBLIC_VAPID_PUBLIC_KEY</b><textarea readOnly rows={3} value={keys.publicKey}/></label>
        <button type="button" className="secondary" onClick={()=>void copy(keys.publicKey)}>Copia publicKey</button>
        <label><b>VAPID_PRIVATE_KEY</b><textarea readOnly rows={3} value={keys.privateKey}/></label>
        <button type="button" className="secondary" onClick={()=>void copy(keys.privateKey)}>Copia privateKey</button>
        <p><b>Passo successivo obbligatorio:</b> salva subito le due chiavi in Vercel, disabilita il generatore e segui il file <code>02-RIMOZIONE-COMPLETA.md</code>.</p>
      </div>}
    </section>
  </>;
}
