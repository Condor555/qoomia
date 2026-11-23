'use client';

import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

type SheetSize='compact'|'medium'|'large'|'full';

type AdaptiveSheetProps={
  open:boolean;
  onClose:()=>void;
  title:string;
  eyebrow?:string;
  children:ReactNode;
  size?:SheetSize;
  busy?:boolean;
  dirty?:boolean;
  closeLabel?:string;
  discardTitle?:string;
  discardMessage?:string;
  className?:string;
  showHeader?:boolean;
};

const focusable='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function AdaptiveSheet({
  open,onClose,title,eyebrow,children,size='large',busy=false,dirty=false,
  closeLabel='Chiudi',discardTitle='Scartare le modifiche?',
  discardMessage='Le modifiche non salvate andranno perse.',className='',showHeader=true,
}:AdaptiveSheetProps){
  const titleId=useId();
  const panelRef=useRef<HTMLDivElement|null>(null);
  const returnFocusRef=useRef<HTMLElement|null>(null);
  const [mounted,setMounted]=useState(false);
  const [confirmDiscard,setConfirmDiscard]=useState(false);

  useEffect(()=>setMounted(true),[]);

  function requestClose(){
    if(busy)return;
    if(dirty){setConfirmDiscard(true);return;}
    onClose();
  }

  useEffect(()=>{
    if(!open||!mounted)return;
    returnFocusRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const shell=document.querySelector<HTMLElement>('.shell');
    const nav=document.querySelector<HTMLElement>('.bottom-nav');
    const previousOverflow=document.body.style.overflow;
    const previousShellInert=shell?.inert;
    const previousNavInert=nav?.inert;
    document.body.style.overflow='hidden';
    if(shell)shell.inert=true;
    if(nav)nav.inert=true;
    const frame=window.requestAnimationFrame(()=>{
      const content=panelRef.current?.querySelector<HTMLElement>('.adaptive-sheet-content');
      if(content)content.scrollTop=0;
      const first=panelRef.current?.querySelector<HTMLElement>('[autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
      (first||panelRef.current)?.focus({preventScroll:true});
      if(content)content.scrollTop=0;
    });
    return()=>{
      window.cancelAnimationFrame(frame);
      document.body.style.overflow=previousOverflow;
      if(shell)shell.inert=Boolean(previousShellInert);
      if(nav)nav.inert=Boolean(previousNavInert);
      returnFocusRef.current?.focus({preventScroll:true});
    };
  },[open,mounted]);

  useEffect(()=>{
    if(!open)return;
    function onKeyDown(event:KeyboardEvent){
      if(event.key==='Escape'){
        event.preventDefault();
        if(confirmDiscard)setConfirmDiscard(false);else requestClose();
        return;
      }
      if(event.key!=='Tab'||confirmDiscard)return;
      const nodes=[...(panelRef.current?.querySelectorAll<HTMLElement>(focusable)||[])].filter(node=>node.offsetParent!==null);
      if(!nodes.length){event.preventDefault();panelRef.current?.focus();return;}
      const first=nodes[0],last=nodes[nodes.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    window.addEventListener('keydown',onKeyDown);
    return()=>window.removeEventListener('keydown',onKeyDown);
  },[open,busy,dirty,confirmDiscard]);

  if(!open||!mounted)return null;

  return createPortal(
    <div className="adaptive-sheet-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)requestClose()}}>
      <div ref={panelRef} className={`adaptive-sheet adaptive-sheet-${size} surface ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <span className="adaptive-sheet-grabber" aria-hidden="true"/>
        {showHeader&&<header className="adaptive-sheet-header"><div>{eyebrow&&<small>{eyebrow}</small>}<h2 id={titleId}>{title}</h2></div><button type="button" className="sheet-close" aria-label={closeLabel} disabled={busy} onClick={requestClose}>×</button></header>}
        {!showHeader&&<h2 id={titleId} className="sr-only">{title}</h2>}
        <div className="adaptive-sheet-content">{children}</div>
        {confirmDiscard&&<div className="sheet-discard-layer" role="alertdialog" aria-modal="true" aria-labelledby={`${titleId}-discard-title`}><div className="sheet-discard-card surface"><span aria-hidden="true">!</span><h3 id={`${titleId}-discard-title`}>{discardTitle}</h3><p>{discardMessage}</p><div><button type="button" className="secondary" onClick={()=>setConfirmDiscard(false)}>Continua a modificare</button><button type="button" className="delete-btn" onClick={()=>{setConfirmDiscard(false);onClose()}}>Scarta</button></div></div></div>}
      </div>
    </div>,
    document.body,
  );
}
