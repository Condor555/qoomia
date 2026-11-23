'use client';

import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import Icon from './Icon';
import {useI18n} from './LanguageProvider';

export type SpacePickerOption={id:string;name:string;type:'personal'|'shared'|string};

type Props={
  spaces:SpacePickerOption[];
  value:string;
  onChange:(spaceId:string)=>void|Promise<void>;
  variant?:'compact'|'destination';
  label?:string;
  help?:string;
  disabled?:boolean;
  className?:string;
};

export default function SpacePicker({spaces,value,onChange,variant='destination',label,help,disabled=false,className=''}:Props){
  const {t}=useI18n();
  const [open,setOpen]=useState(false);
  const [activeIndex,setActiveIndex]=useState(0);
  const [viewportHeight,setViewportHeight]=useState(0);
  const rootRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const optionRefs=useRef<Array<HTMLButtonElement|null>>([]);
  const listboxId=useId();
  const selectedIndex=Math.max(0,spaces.findIndex(space=>space.id===value));
  const selected=spaces[selectedIndex];

  useEffect(()=>{
    if(!open)return;
    const close=(event:PointerEvent)=>{
      if(rootRef.current&&!rootRef.current.contains(event.target as Node))setOpen(false);
    };
    document.addEventListener('pointerdown',close);
    return()=>document.removeEventListener('pointerdown',close);
  },[open]);

  useEffect(()=>{
    if(!open)return;
    const visual=window.visualViewport;
    const update=()=>setViewportHeight(Math.max(280,visual?.height||window.innerHeight));
    update();visual?.addEventListener('resize',update);visual?.addEventListener('scroll',update);
    return()=>{visual?.removeEventListener('resize',update);visual?.removeEventListener('scroll',update)};
  },[open]);

  useEffect(()=>{
    if(open)optionRefs.current[activeIndex]?.focus();
  },[open,activeIndex]);

  useEffect(()=>{
    if(!spaces.some(space=>space.id===value)&&spaces.length)setActiveIndex(0);
  },[spaces,value]);

  function show(index=selectedIndex){
    if(disabled||!spaces.length)return;
    setActiveIndex(Math.max(0,index));
    setOpen(true);
  }

  function choose(spaceId:string){
    if(disabled)return;
    setOpen(false);
    if(spaceId!==value)void onChange(spaceId);
    requestAnimationFrame(()=>triggerRef.current?.focus());
  }

  function triggerKeys(event:React.KeyboardEvent<HTMLButtonElement>){
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      const index=event.key==='ArrowDown'?selectedIndex:Math.max(0,selectedIndex);
      show(index);
    }
  }

  function listKeys(event:React.KeyboardEvent<HTMLDivElement>){
    if(event.key==='ArrowDown'){
      event.preventDefault();
      setActiveIndex(index=>(index+1)%spaces.length);
    }else if(event.key==='ArrowUp'){
      event.preventDefault();
      setActiveIndex(index=>(index-1+spaces.length)%spaces.length);
    }else if(event.key==='Home'){
      event.preventDefault();setActiveIndex(0);
    }else if(event.key==='End'){
      event.preventDefault();setActiveIndex(spaces.length-1);
    }else if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      const option=spaces[activeIndex];
      if(option)choose(option.id);
    }else if(event.key==='Escape'){
      event.preventDefault();setOpen(false);triggerRef.current?.focus();
    }else if(event.key==='Tab'){
      setOpen(false);
    }
  }

  const iconName=selected?.type==='personal'?'user':'family';
  const accessibleLabel=label||(variant==='compact'?t('space.viewed'):t('space.destination'));

  return <div ref={rootRef} className={`space-picker space-picker-${variant}${open?' is-open':''}${className?` ${className}`:''}`} style={{'--visual-viewport-height':viewportHeight?`${viewportHeight}px`:'100dvh'} as CSSProperties}>
    {variant==='destination'&&<label className="space-picker-label">{accessibleLabel}</label>}
    <button
      ref={triggerRef}
      type="button"
      className="space-picker-trigger"
      aria-label={`${accessibleLabel}: ${selected?.name||t('space.none')}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open?listboxId:undefined}
      title={accessibleLabel}
      disabled={disabled||!spaces.length}
      onClick={()=>open?setOpen(false):show()}
      onKeyDown={triggerKeys}
    >
      <span className="space-picker-trigger-icon" aria-hidden="true"><Icon name={iconName} size={variant==='compact'?16:20}/></span>
      <span className="space-picker-trigger-copy">
        {variant==='destination'&&<small>{selected?.type==='personal'?t('space.personal'):t('space.shared')}</small>}
        <strong>{selected?.name||t('space.select')}</strong>
      </span>
      <span className="space-picker-trigger-chevron" aria-hidden="true"><Icon name="arrowDown" size={variant==='compact'?14:17}/></span>
    </button>
    {help&&variant==='destination'&&<small className="space-picker-help">{help}</small>}
    {open&&<div id={listboxId} className="space-picker-list" role="listbox" aria-label={accessibleLabel} onKeyDown={listKeys}>
      {spaces.map((space,index)=>{
        const chosen=space.id===value;
        return <button
          ref={node=>{optionRefs.current[index]=node}}
          key={space.id}
          type="button"
          role="option"
          aria-selected={chosen}
          className={`space-picker-option${chosen?' selected':''}`}
          tabIndex={index===activeIndex?0:-1}
          onMouseEnter={()=>setActiveIndex(index)}
          onClick={()=>choose(space.id)}
        >
          <span aria-hidden="true"><Icon name={space.type==='personal'?'user':'family'} size={18}/></span>
          <span><strong>{space.name}</strong><small>{space.type==='personal'?t('space.personalShort'):t('space.sharedShort')}</small></span>
          <b aria-hidden="true">{chosen?'✓':''}</b>
        </button>;
      })}
    </div>}
  </div>;
}


