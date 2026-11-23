'use client';

import {useCallback,useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
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

type PopoverPosition={top:number;left:number;width:number;maxHeight:number;placement:'above'|'below'};
const EDGE=12;
const GAP=7;
const MIN_WIDTH=240;
const MAX_WIDTH=320;
const MIN_USEFUL_HEIGHT=148;

export default function SpacePicker({spaces,value,onChange,variant='destination',label,help,disabled=false,className=''}:Props){
  const {t}=useI18n();
  const [open,setOpen]=useState(false);
  const [activeIndex,setActiveIndex]=useState(0);
  const [mounted,setMounted]=useState(false);
  const [position,setPosition]=useState<PopoverPosition|null>(null);
  const rootRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const listRef=useRef<HTMLDivElement>(null);
  const optionRefs=useRef<Array<HTMLButtonElement|null>>([]);
  const listboxId=useId();
  const selectedIndex=Math.max(0,spaces.findIndex(space=>space.id===value));
  const selected=spaces[selectedIndex];

  useEffect(()=>setMounted(true),[]);

  const updatePosition=useCallback(()=>{
    const trigger=triggerRef.current;
    if(!trigger)return;
    const rect=trigger.getBoundingClientRect();
    const visual=window.visualViewport;
    const viewportLeft=visual?.offsetLeft||0;
    const viewportTop=visual?.offsetTop||0;
    const viewportWidth=visual?.width||window.innerWidth;
    const viewportHeight=visual?.height||window.innerHeight;
    const rootStyle=getComputedStyle(document.documentElement);
    const safeLeft=parseFloat(rootStyle.getPropertyValue('--q-safe-left'))||0;
    const safeRight=parseFloat(rootStyle.getPropertyValue('--q-safe-right'))||0;
    const safeTop=parseFloat(rootStyle.getPropertyValue('--q-safe-top'))||0;
    const safeBottom=parseFloat(rootStyle.getPropertyValue('--q-safe-bottom'))||0;
    const edgeLeft=viewportLeft+Math.max(EDGE,safeLeft);
    const edgeRight=viewportLeft+viewportWidth-Math.max(EDGE,safeRight);
    const edgeTop=viewportTop+Math.max(EDGE,safeTop);
    const edgeBottom=viewportTop+viewportHeight-Math.max(EDGE,safeBottom);
    const width=Math.min(MAX_WIDTH,Math.max(MIN_WIDTH,rect.width),Math.max(180,edgeRight-edgeLeft));
    const preferredLeft=variant==='compact'?rect.right-width:rect.left;
    const left=Math.min(Math.max(preferredLeft,edgeLeft),edgeRight-width);
    const below=Math.max(0,edgeBottom-rect.bottom-GAP);
    const above=Math.max(0,rect.top-edgeTop-GAP);
    const placement:PopoverPosition['placement']=below>=Math.min(MIN_USEFUL_HEIGHT,above)||below>=above?'below':'above';
    const available=placement==='below'?below:above;
    const maxHeight=Math.max(96,Math.min(320,available));
    const measuredHeight=listRef.current?.scrollHeight||Math.min(320,spaces.length*54+12);
    const renderedHeight=Math.min(measuredHeight,maxHeight);
    const top=placement==='below'?rect.bottom+GAP:rect.top-GAP-renderedHeight;
    setPosition({top:Math.max(edgeTop,top),left,width,maxHeight,placement});
  },[spaces.length,variant]);

  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{
      const node=event.target as Node;
      if(!rootRef.current?.contains(node)&&!listRef.current?.contains(node))setOpen(false);
    };
    const escape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();
        setOpen(false);
        requestAnimationFrame(()=>triggerRef.current?.focus());
      }
    };
    const reposition=()=>updatePosition();
    document.addEventListener('pointerdown',outside);
    window.addEventListener('keydown',escape);
    window.addEventListener('resize',reposition);
    window.addEventListener('scroll',reposition,true);
    window.visualViewport?.addEventListener('resize',reposition);
    window.visualViewport?.addEventListener('scroll',reposition);
    updatePosition();
    const frame=requestAnimationFrame(()=>{updatePosition();optionRefs.current[Math.max(0,activeIndex)]?.focus({preventScroll:true})});
    return()=>{
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown',outside);
      window.removeEventListener('keydown',escape);
      window.removeEventListener('resize',reposition);
      window.removeEventListener('scroll',reposition,true);
      window.visualViewport?.removeEventListener('resize',reposition);
      window.visualViewport?.removeEventListener('scroll',reposition);
    };
  },[open,activeIndex,updatePosition]);

  useEffect(()=>{
    if(!spaces.some(space=>space.id===value)&&spaces.length)setActiveIndex(0);
  },[spaces,value]);

  function show(index=selectedIndex){
    if(disabled||!spaces.length)return;
    setActiveIndex(Math.max(0,index));
    setPosition(null);
    setOpen(true);
  }

  function close(restoreFocus=true){
    setOpen(false);
    setPosition(null);
    if(restoreFocus)requestAnimationFrame(()=>triggerRef.current?.focus({preventScroll:true}));
  }

  function choose(spaceId:string){
    if(disabled)return;
    close();
    if(spaceId!==value)void onChange(spaceId);
  }

  function triggerKeys(event:React.KeyboardEvent<HTMLButtonElement>){
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      show(selectedIndex);
    }else if(event.key==='Escape'&&open){
      event.preventDefault();close();
    }
  }

  function listKeys(event:React.KeyboardEvent<HTMLDivElement>){
    if(event.key==='ArrowDown'){
      event.preventDefault();setActiveIndex(index=>(index+1)%spaces.length);
    }else if(event.key==='ArrowUp'){
      event.preventDefault();setActiveIndex(index=>(index-1+spaces.length)%spaces.length);
    }else if(event.key==='Home'){
      event.preventDefault();setActiveIndex(0);
    }else if(event.key==='End'){
      event.preventDefault();setActiveIndex(spaces.length-1);
    }else if(event.key==='Enter'||event.key===' '){
      event.preventDefault();const option=spaces[activeIndex];if(option)choose(option.id);
    }else if(event.key==='Escape'){
      event.preventDefault();close();
    }else if(event.key==='Tab')setOpen(false);
  }

  const iconName=selected?.type==='personal'?'user':'family';
  const accessibleLabel=label||(variant==='compact'?t('space.viewed'):t('space.destination'));
  const popover=open&&mounted?createPortal(
    <div
      ref={listRef}
      id={listboxId}
      className={`space-picker-list space-picker-popover space-picker-popover-${variant}${position?` is-${position.placement}`:' is-positioning'}`}
      role="listbox"
      aria-label={accessibleLabel}
      data-space-picker-popover=""
      style={position?{position:'fixed',top:position.top,left:position.left,width:position.width,maxHeight:position.maxHeight} as CSSProperties:undefined}
      onKeyDown={listKeys}
    >
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
    </div>,
    document.body,
  ):null;

  return <div ref={rootRef} className={`space-picker space-picker-${variant}${open?' is-open':''}${className?` ${className}`:''}`}>
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
      onClick={()=>open?close(false):show()}
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
    {popover}
  </div>;
}
