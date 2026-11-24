'use client';

import {useEffect,useRef,useState} from 'react';

type InstallChoice={outcome:'accepted'|'dismissed';platform:string};
type BeforeInstallPromptEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<InstallChoice>;
};
type PromptMode='hidden'|'android'|'ios';

const DISMISS_KEY='qoomia:pwa-install-dismissed-at';
const DISMISS_FOR_MS=7*24*60*60*1000;

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches||
    Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
}

function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent)||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}

function wasDismissedRecently(){
  try{
    const dismissedAt=Number(window.localStorage.getItem(DISMISS_KEY)||0);
    return Number.isFinite(dismissedAt)&&Date.now()-dismissedAt<DISMISS_FOR_MS;
  }catch{return false}
}

export default function PwaInstallPrompt(){
  const deferredPrompt=useRef<BeforeInstallPromptEvent|null>(null);
  const [mode,setMode]=useState<PromptMode>('hidden');
  const [installing,setInstalling]=useState(false);

  useEffect(()=>{
    if('serviceWorker' in navigator&&process.env.NODE_ENV==='production'){
      void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(registration=>registration.update()).catch(error=>{
        console.error('Qoomia service worker registration failed',error);
      });
    }

    if(isStandalone()||wasDismissedRecently())return;

    const handleInstallPrompt=(event:Event)=>{
      event.preventDefault();
      deferredPrompt.current=event as BeforeInstallPromptEvent;
      setMode('android');
    };
    const handleInstalled=()=>{
      deferredPrompt.current=null;
      setMode('hidden');
      try{window.localStorage.removeItem(DISMISS_KEY)}catch{}
    };

    window.addEventListener('beforeinstallprompt',handleInstallPrompt);
    window.addEventListener('appinstalled',handleInstalled);

    let iosTimer:number|undefined;
    if(isIOS())iosTimer=window.setTimeout(()=>setMode(current=>current==='hidden'?'ios':current),1200);

    return()=>{
      window.removeEventListener('beforeinstallprompt',handleInstallPrompt);
      window.removeEventListener('appinstalled',handleInstalled);
      if(iosTimer)window.clearTimeout(iosTimer);
    };
  },[]);

  function dismiss(){
    deferredPrompt.current=null;
    setMode('hidden');
    try{window.localStorage.setItem(DISMISS_KEY,String(Date.now()))}catch{}
  }

  async function install(){
    const prompt=deferredPrompt.current;
    if(!prompt)return;
    setInstalling(true);
    try{
      await prompt.prompt();
      const choice=await prompt.userChoice;
      if(choice.outcome==='accepted')setMode('hidden');
      else dismiss();
    }finally{
      deferredPrompt.current=null;
      setInstalling(false);
    }
  }

  if(mode==='hidden')return null;

  return <aside className="pwa-install-card" aria-live="polite" aria-label="Installa Qoomia">
    <button type="button" className="pwa-install-close" aria-label="Chiudi" onClick={dismiss}>×</button>
    <img src="/icons/qoomia-v4-1-192.png" width="48" height="48" alt=""/>
    <div className="pwa-install-copy">
      <strong>Installa Qoomia</strong>
      {mode==='android'
        ?<p>Usala a schermo intero, direttamente dalla schermata Home.</p>
        :<p>In Safari tocca <b>Condividi</b>, poi <b>Aggiungi alla schermata Home</b> e conferma.</p>}
    </div>
    {mode==='android'&&<button type="button" className="pwa-install-action" disabled={installing} onClick={install}>{installing?'Apertura…':'Installa'}</button>}
  </aside>;
}
