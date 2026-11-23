'use client';

import {useEffect,useState} from 'react';
import AdaptiveSheet from '../../components/AdaptiveSheet';
import BackToAccount from '../../components/BackToAccount';
import ConfirmDialog from '../../components/ConfirmDialog';
import Icon from '../../components/Icon';

type Space={id:string;name:string;type:string;invite_code?:string;role:string};
type Member={userId:string;name:string;role:string;joinedAt:string};

export default function Spazi(){
  const [rows,setRows]=useState<Space[]>([]),[members,setMembers]=useState<Record<string,Member[]>>({}),[requests,setRequests]=useState<Record<string,any>>({});
  const [name,setName]=useState('Famiglia'),[join,setJoin]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  const [renameSpace,setRenameSpace]=useState<Space|null>(null),[renameName,setRenameName]=useState(''),[deleteSpace,setDeleteSpace]=useState<Space|null>(null);

  async function load(){
    const j=await fetch('/api/spaces',{cache:'no-store'}).then(r=>r.json());
    const list:Space[]=j.data||[];
    setRows(list);
    const shared=list.filter(space=>space.type==='shared');
    const details=await Promise.all(shared.map(async space=>{
      const [memberResult,requestResult]=await Promise.all([
        fetch(`/api/spaces/${space.id}/members`,{cache:'no-store'}).then(response=>response.json()),
        fetch(`/api/spaces/${space.id}/delete-request`,{cache:'no-store'}).then(response=>response.json()),
      ]);
      return {id:space.id,members:memberResult.data||[],request:requestResult.data||null};
    }));
    setMembers(Object.fromEntries(details.map(item=>[item.id,item.members])));
    setRequests(Object.fromEntries(details.map(item=>[item.id,item.request])));
  }

  useEffect(()=>{void load()},[]);

  async function create(){setBusy(true);try{const r=await fetch('/api/spaces',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name})});const j=await r.json();setMsg(r.ok?`Spazio creato. Codice invito: ${j.data.invite_code}`:j.error);if(r.ok)await load()}finally{setBusy(false)}}
  async function enter(){setBusy(true);try{const r=await fetch('/api/spaces/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:join})});const j=await r.json();setMsg(r.ok?`Sei entrato in ${j.data.name}`:j.error);if(r.ok)await load()}finally{setBusy(false)}}
  function beginRename(space:Space){setRenameSpace(space);setRenameName(space.name)}
  async function rename(){if(!renameSpace)return;const next=renameName.trim();if(!next||next===renameSpace.name){setRenameSpace(null);return}setBusy(true);try{const r=await fetch(`/api/spaces/${renameSpace.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:next})});const j=await r.json();setMsg(r.ok?'Spazio rinominato':j.error);if(r.ok){setRenameSpace(null);await load()}}finally{setBusy(false)}}
  async function remove(){const space=deleteSpace;if(!space)return;setBusy(true);try{const r=await fetch(`/api/spaces/${space.id}/delete-request`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const j=await r.json();if(!r.ok){setMsg(j.error);return}setDeleteSpace(null);if(j.status==='deleted'){localStorage.removeItem('active_space');setMsg('Spazio eliminato.');await load();return}setMsg(`Richiesta inviata: ${j.approved||1}/${j.members} approvazioni.`);await load()}finally{setBusy(false)}}
  async function vote(space:Space,vote:'approve'|'reject'){const q=requests[space.id];if(!q)return;setBusy(true);try{const r=await fetch(`/api/spaces/${space.id}/delete-request`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:q.id,vote})});const j=await r.json();if(j.status==='deleted'){localStorage.removeItem('active_space');setMsg('Spazio eliminato.')}else setMsg(j.status==='rejected'?'Eliminazione rifiutata.':'Voto registrato.');await load()}finally{setBusy(false)}}

  return <>
    <BackToAccount/>
    <header className="page-head"><div><h1>Spazi</h1><p>Personale e condivisi</p></div></header>
    {msg&&<div className="notice" role="status">{msg}</div>}
    <section className="settings-card surface"><h2>I tuoi spazi</h2>{rows.map(space=><div className="space-manage" key={space.id}><div className="space-title"><span><Icon name={space.type==='personal'?'user':'family'}/></span><div><b>{space.name}</b><small>{space.type==='personal'?'Privato':space.role==='owner'?'Condiviso · Proprietario':'Condiviso · Membro'}</small></div>{space.invite_code&&space.role==='owner'&&<code>{space.invite_code}</code>}</div>{space.type==='shared'&&<><div className="member-list">{(members[space.id]||[]).map(member=><div key={member.userId}><span className="member-avatar">{member.name.slice(0,1).toUpperCase()}</span><span><b>{member.name}</b><small>{member.role==='owner'?'Proprietario':'Membro'}</small></span></div>)}</div><div className="space-actions">{space.role==='owner'&&<button disabled={busy} onClick={()=>beginRename(space)}>Rinomina</button>}<button className="space-delete" disabled={busy} onClick={()=>setDeleteSpace(space)}>Elimina spazio</button></div>{requests[space.id]&&<div className="delete-request"><b>Richiesta di eliminazione in corso</b><p>Tutti i membri devono approvare.</p><div><button disabled={busy} onClick={()=>vote(space,'approve')}>Approva</button><button className="reject" disabled={busy} onClick={()=>vote(space,'reject')}>Rifiuta</button></div></div>}</>}</div>)}</section>
    <section className="settings-card surface"><h2>Crea spazio condiviso</h2><input value={name} onChange={event=>setName(event.target.value)} placeholder="Es. Famiglia"/><button className="save-btn" disabled={busy} onClick={create}>Crea spazio</button></section>
    <section className="settings-card surface"><h2>Unisciti con un codice</h2><input value={join} onChange={event=>setJoin(event.target.value.toUpperCase())} placeholder="Es. F37BCDD9"/><button className="save-btn" disabled={busy} onClick={enter}>Unisciti</button></section>

    <AdaptiveSheet open={Boolean(renameSpace)} onClose={()=>setRenameSpace(null)} title="Rinomina spazio" eyebrow={renameSpace?.name} size="compact" busy={busy}>
      <form onSubmit={event=>{event.preventDefault();void rename()}}><label className="field"><span>Nuovo nome</span><input autoFocus required minLength={2} maxLength={60} value={renameName} onChange={event=>setRenameName(event.target.value)}/></label><button className="save-btn" disabled={busy}>{busy?'Salvataggio…':'Salva nome'}</button></form>
    </AdaptiveSheet>
    <ConfirmDialog open={Boolean(deleteSpace)} title="Eliminare lo spazio?" message={deleteSpace?`Vuoi eliminare “${deleteSpace.name}”? Se ci sono altri membri, dovranno approvare.`:''} confirmLabel="Elimina spazio" destructive busy={busy} onClose={()=>setDeleteSpace(null)} onConfirm={remove}/>
  </>;
}
