'use client';

import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';

type ToastTone='success'|'error'|'info';
type ToastInput={message:string;tone?:ToastTone;duration?:number};
type ToastItem=ToastInput&{id:number};
type ToastContextValue={showToast:(toast:string|ToastInput)=>void};

const ToastContext=createContext<ToastContextValue|null>(null);

export default function ToastProvider({children}:{children:ReactNode}){
  const [items,setItems]=useState<ToastItem[]>([]);
  const nextId=useRef(0);
  const timers=useRef(new Map<number,number>());

  const dismiss=useCallback((id:number)=>{
    const timer=timers.current.get(id);
    if(timer)window.clearTimeout(timer);
    timers.current.delete(id);
    setItems(current=>current.filter(item=>item.id!==id));
  },[]);

  const showToast=useCallback((input:string|ToastInput)=>{
    const toast=typeof input==='string'?{message:input}:input;
    const id=++nextId.current;
    const item:ToastItem={id,message:toast.message,tone:toast.tone||'success',duration:toast.duration??3200};
    setItems(current=>[...current.slice(-2),item]);
    const timer=window.setTimeout(()=>dismiss(id),item.duration);
    timers.current.set(id,timer);
  },[dismiss]);

  useEffect(()=>()=>{for(const timer of timers.current.values())window.clearTimeout(timer);timers.current.clear()},[]);
  const value=useMemo(()=>({showToast}),[showToast]);

  return <ToastContext.Provider value={value}>{children}<div className="toast-viewport" aria-live="polite" aria-atomic="true">{items.map(item=><div className={`app-toast app-toast-${item.tone}`} role={item.tone==='error'?'alert':'status'} key={item.id}><span aria-hidden="true">{item.tone==='success'?'✓':item.tone==='error'?'!':'i'}</span><p>{item.message}</p><button type="button" aria-label="Chiudi notifica" onClick={()=>dismiss(item.id)}>×</button></div>)}</div></ToastContext.Provider>;
}

export function useToast(){
  const value=useContext(ToastContext);
  if(!value)throw new Error('useToast deve essere usato dentro ToastProvider');
  return value;
}
