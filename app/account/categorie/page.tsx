'use client';

import { useEffect, useRef, useState } from 'react';
import BackToAccount from '../../../components/BackToAccount';
import AdaptiveSheet from '../../../components/AdaptiveSheet';
import ConfirmDialog from '../../../components/ConfirmDialog';
import IconCatalogPicker from '../../../components/IconCatalogPicker';
import CategoryIcon from '../../../components/CategoryIcon';
import SpacePicker,{type SpacePickerOption} from '../../../components/SpacePicker';
import {InlineError} from '../../../components/UXFeedback';
import {
  colorChoices,
  inferredCategoryStyle,
} from '../../../lib/category-style';

type Cat = {
  name: string;
  kind: 'expense' | 'income';
  icon: string;
  color: string;
  count?: number;
};

type Space=SpacePickerOption&{role:'owner'|'member'|string};

export default function Categorie() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [spaces,setSpaces]=useState<Space[]>([]);
  const [spaceId,setSpaceId]=useState('');
  const [loadingSpaces,setLoadingSpaces]=useState(true);
  const [loadingCategories,setLoadingCategories]=useState(false);
  const loadRequestRef=useRef(0);
  const [tab, setTab] = useState<'expense'|'income'>('expense');

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('tag');
  const [color, setColor] = useState(colorChoices[0]);

  const [editing, setEditing] = useState<Cat | null>(null);
  const [creating,setCreating]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [originalName, setOriginalName] = useState('');
  const [target, setTarget] = useState('');

  const [msg, setMsg] = useState('');

  async function load(targetSpaceId=spaceId) {
    if(!targetSpaceId){setCats([]);return;}
    const request=++loadRequestRef.current;
    setLoadingCategories(true);
    setMsg('');
    try{
      const response=await fetch(`/api/categories?spaceId=${encodeURIComponent(targetSpaceId)}`,{cache:'no-store'});
      const result=await response.json();
      if(request!==loadRequestRef.current)return;
      if(!response.ok){setCats([]);setMsg(result.error||'Impossibile caricare le categorie.');return;}
      setCats(result.data||[]);
    }catch{
      if(request===loadRequestRef.current){setCats([]);setMsg('Errore di connessione durante il caricamento.');}
    }finally{
      if(request===loadRequestRef.current)setLoadingCategories(false);
    }
  }

  useEffect(() => {
    let live=true;
    setLoadingSpaces(true);
    fetch('/api/spaces',{cache:'no-store'})
      .then(async response=>({ok:response.ok,result:await response.json()}))
      .then(({ok,result})=>{
        if(!live)return;
        if(!ok){setMsg(result.error||'Impossibile caricare gli spazi.');return;}
        const list:Space[]=result.data||[];
        const initial=result.activeSpaceId||list.find(space=>space.type==='personal')?.id||list[0]?.id||'';
        setSpaces(list);
        setSpaceId(initial);
        if(initial)void load(initial);
      })
      .catch(()=>{if(live)setMsg('Errore di connessione durante il caricamento degli spazi.');})
      .finally(()=>{if(live)setLoadingSpaces(false);});
    return()=>{live=false;loadRequestRef.current++};
  }, []);

  function chooseSpace(nextSpaceId:string){
    if(nextSpaceId===spaceId)return;
    setSpaceId(nextSpaceId);
    setCats([]);
    setEditing(null);
    setOriginalName('');
    setTarget('');
    setName('');
    setIcon('tag');
    setColor(colorChoices[0]);
    setCreating(false);
    setMsg('');
    void load(nextSpaceId);
  }

  function selectTab(next: 'expense'|'income') {
    setTab(next);
    setName('');
    setIcon('tag');
    setColor(colorChoices[0]);
    setEditing(null);
    setOriginalName('');
    setTarget('');
    setMsg('');
  }

  function changeName(value: string) {
    setName(value);

    if (value) {
      const style = inferredCategoryStyle(value);
      setIcon(style.icon);
      setColor(style.color);
    }
  }

  async function createCategory() {
    if (name.trim().length < 2) {
      setMsg('Inserisci un nome di almeno 2 caratteri.');
      return;
    }

    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        spaceId,
        name,
        kind: tab,
        icon,
        color,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMsg(result.error || 'Errore nella creazione.');
      return;
    }

    setMsg('Categoria creata.');
    setName('');
    setIcon('tag');
    setColor(colorChoices[0]);
    setCreating(false);

    load(spaceId);
  }

  function openCategory(category: Cat) {
    setEditing({ ...category });
    setOriginalName(category.name);
    setTarget('');
    setMsg('');
  }

  async function saveCategory() {
    if (!editing) return;

    const newName = editing.name.trim();

    if (newName.length < 2) {
      setMsg('Il nome deve avere almeno 2 caratteri.');
      return;
    }

    const response = await fetch(
      '/api/categories/' + encodeURIComponent(originalName),
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          spaceId,
          newName,
          icon: editing.icon,
          color: editing.color,
           kind: editing.kind,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setMsg(result.error || 'Errore nella modifica.');
      return;
    }

    const savedKind=editing.kind;
    setMsg('Categoria modificata.');
    setEditing(null);
    setOriginalName('');
    setTarget('');
    setTab(savedKind);

    load(spaceId);
  }

  async function removeCategory() {
    if (!editing) return;

    const response = await fetch(
      '/api/categories?name=' +
        encodeURIComponent(originalName) +
        '&spaceId=' + encodeURIComponent(spaceId),
      {
        method: 'DELETE',
      }
    );

    const result = await response.json();

    if (response.ok) {
      setMsg('Categoria eliminata.');
      setEditing(null);
      setOriginalName('');
      setTarget('');

      load(spaceId);
      return;
    }

    if (response.status === 409) {
      setMsg(
        `La categoria contiene ${result.count} transazioni. ` +
          'Scegli una categoria di destinazione e usa "Migra ed elimina".'
      );
      return;
    }

    setMsg(result.error || 'Errore durante eliminazione.');
  }

  async function mergeCategory() {
    if (!editing || !target) return;

    const response = await fetch('/api/categories/merge', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        spaceId,
        source: originalName,
        target,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMsg(result.error || 'Errore durante la migrazione.');
      return;
    }

    setMsg('Transazioni migrate e categoria eliminata.');

    setEditing(null);
    setOriginalName('');
    setTarget('');

    load(spaceId);
  }

  function closeEditor() {
    setEditing(null);
    setOriginalName('');
    setTarget('');
  }
  function closeCreate(){setCreating(false);setName('');setIcon('tag');setColor(colorChoices[0]);setMsg('')}

  const selectedSpace=spaces.find(space=>space.id===spaceId);

  return (
    <>
      <BackToAccount />

      <header className="page-head">
        <div>
          <h1>Categorie</h1>
          <p>{loadingCategories?'Caricamento…':`${cats.length} categorie in ${selectedSpace?.name||'questo spazio'}`}</p>
        </div>
      </header>

      <section className="settings-card surface category-space-card">
        <div><h2>Spazio categorie</h2><p className="settings-help">Le categorie restano separate tra Personale e ogni spazio condiviso.</p></div>
        <SpacePicker
          spaces={spaces}
          value={spaceId}
          onChange={chooseSpace}
          variant="compact"
          label="Spazio da gestire"
          disabled={loadingSpaces||loadingCategories}
          className="category-space-picker"
        />
      </section>

      <div className="segmented category-kind-tabs" role="tablist" aria-label="Tipo categorie">
        <button id="categories-expense-tab" type="button" role="tab" aria-selected={tab==='expense'} aria-controls="categories-expense-panel" className={tab==='expense'?'active':''} onClick={()=>selectTab('expense')}>Uscite ({cats.filter(item=>item.kind==='expense').length})</button>
        <button id="categories-income-tab" type="button" role="tab" aria-selected={tab==='income'} aria-controls="categories-income-panel" className={tab==='income'?'active':''} onClick={()=>selectTab('income')}>Entrate ({cats.filter(item=>item.kind==='income').length})</button>
      </div>

      <div id={`categories-${tab}-panel`} role="tabpanel" aria-labelledby={`categories-${tab}-tab`}>
      <div className="category-primary-action"><button type="button" disabled={!spaceId||loadingCategories} onClick={()=>{setCreating(true);setMsg('')}}>+ Nuova categoria</button></div>
      {msg&&!editing&&!creating&&<div className="notice" role="status">{msg}</div>}

      <section className="settings-card surface">
        <h2>Categorie di {tab==='income'?'entrata':'uscita'}</h2>

        <div className="category-settings">
          {cats.filter(category=>category.kind===tab).map((category) => (
            <button
              type="button"
              className="category-setting"
              key={category.name}
              onClick={() => openCategory(category)}
            >
              <CategoryIcon
                name={category.name}
                icon={category.icon}
                color={category.color}
                size={36}
              />

              <span>
                <b>{category.name}</b>

                <small>
                  {category.count || 0}{' '}
                  {(category.count || 0) === 1
                    ? 'movimento'
                    : 'movimenti'}
                </small>
              </span>

              <strong>›</strong>
            </button>
          ))}
          {!loadingCategories&&!cats.some(category=>category.kind===tab)&&<div className="category-kind-empty"><b>Nessuna categoria di {tab==='income'?'entrata':'uscita'}</b><small>Creane una usando il modulo qui sopra nello spazio {selectedSpace?.name||'selezionato'}.</small></div>}
          {loadingCategories&&<div className="category-kind-empty" aria-live="polite"><b>Caricamento categorie…</b><small>Sto leggendo soltanto lo spazio selezionato.</small></div>}
        </div>
      </section>
      </div>

      <AdaptiveSheet open={creating} onClose={closeCreate} title="Nuova categoria" eyebrow={tab==='income'?'Entrate':'Uscite'} size="large" dirty={Boolean(name.trim())} className="category-editor-sheet">
        <div className="category-editor-form"><label className="picker-label">Nome</label><input value={name} onChange={(e)=>changeName(e.target.value)} placeholder="Nome categoria" autoFocus/><label className="picker-label">Icona</label><IconCatalogPicker value={icon} onChange={setIcon} suggestFor={name}/><label className="picker-label">Colore</label><div className="color-picker">{colorChoices.map(item=><button key={item} type="button" aria-label={`Colore ${item}`} className={color===item?'selected':''} style={{background:item}} onClick={()=>setColor(item)}/>)}</div>{msg&&<InlineError message={msg}/>}<button className="save-btn" disabled={!spaceId||loadingCategories} onClick={createCategory}>Crea categoria</button></div>
      </AdaptiveSheet>

      {editing && (
        <AdaptiveSheet open onClose={closeEditor} title="Modifica categoria" eyebrow={originalName} size="large" className="category-editor-sheet">
          <div className="category-editor-form">

            <label className="picker-label">
              Nome
            </label>

            <input
              value={editing.name}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  name: e.target.value,
                })
              }
            />

            <label className="picker-label">Tipo</label>
            <div className="segmented category-kind-editor">
              <button type="button" className={editing.kind==='expense'?'active':''} onClick={()=>{setEditing({...editing,kind:'expense'});setTarget('')}}>Uscita</button>
              <button type="button" className={editing.kind==='income'?'active':''} onClick={()=>{setEditing({...editing,kind:'income'});setTarget('')}}>Entrata</button>
            </div>

            <label className="picker-label">
              Icona
            </label>

            <IconCatalogPicker value={editing.icon} onChange={(nextIcon) => setEditing({...editing, icon: nextIcon})} suggestFor={editing.name} />

            <label className="picker-label">
              Colore
            </label>

            <div className="color-picker">
              {colorChoices.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`Colore ${item}`}
                  className={
                    editing.color === item
                      ? 'selected'
                      : ''
                  }
                  style={{
                    background: item,
                  }}
                  onClick={() =>
                    setEditing({
                      ...editing,
                      color: item,
                    })
                  }
                />
              ))}
            </div>

            {msg&&<InlineError message={msg}/>} 

            <div className="category-editor-actions">
              <button className="category-save-button" onClick={saveCategory}>
                Salva modifiche
              </button>
              <button
                className="delete-btn"
                onClick={()=>setConfirmDelete(true)}
              >
                Elimina categoria
              </button>
            </div>

            <div className="merge-box">
              <label>
                Migra transazioni in
              </label>

              <select
                value={target}
                onChange={(e) =>
                  setTarget(e.target.value)
                }
              >
                <option value="">
                  Seleziona categoria...
                </option>

                {cats
                  .filter(
                    (category) =>
                      category.name !== originalName && category.kind === editing.kind
                  )
                  .map((category) => (
                    <option
                      key={category.name}
                      value={category.name}
                    >
                      {category.name}
                    </option>
                  ))}
              </select>

              <button
                className="merge-btn"
                disabled={!target}
                onClick={mergeCategory}
              >
                Migra ed elimina
              </button>
            </div>

          </div>
        </AdaptiveSheet>
      )}
      <ConfirmDialog open={confirmDelete} title="Eliminare la categoria?" message={editing?`La categoria “${editing.name}” verrà eliminata. Se contiene movimenti, Qoomia ti chiederà prima dove migrarli.`:''} confirmLabel="Elimina categoria" destructive onClose={()=>setConfirmDelete(false)} onConfirm={async()=>{setConfirmDelete(false);await removeCategory()}}/>
    </>
  );
}


