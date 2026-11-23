'use client';

import {useEffect,useMemo,useState} from 'react';
import BackToAccount from '../../../components/BackToAccount';
import Icon from '../../../components/Icon';
import {useI18n} from '../../../components/LanguageProvider';

type Threshold=80|90|100;
type Preferences={enabled:boolean;budgetEnabled:boolean;budgetThresholds:Threshold[];goalsEnabled:boolean;goalThresholds:Threshold[]};
type SupportState='checking'|'ready'|'unsupported'|'install-required'|'missing-config';
const defaults:Preferences={enabled:false,budgetEnabled:true,budgetThresholds:[80,90,100],goalsEnabled:true,goalThresholds:[80,90,100]};
const thresholds:Threshold[]=[80,90,100];

function decodeVapidKey(value:string){
  const padding='='.repeat((4-value.length%4)%4);const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);const bytes=new Uint8Array(raw.length);for(let index=0;index<raw.length;index++)bytes[index]=raw.charCodeAt(index);return bytes;
}
function standalone(){return window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}

export default function NotificationSettings(){
  const {t}=useI18n();
  const [preferences,setPreferences]=useState<Preferences>(defaults);
  const [vapidKey,setVapidKey]=useState('');
  const [support,setSupport]=useState<SupportState>('checking');
  const [subscribed,setSubscribed]=useState(false);
  const [permission,setPermission]=useState<NotificationPermission>('default');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const active=preferences.enabled&&subscribed&&permission==='granted';

  useEffect(()=>{
    let live=true;
    async function load(){
      try{
        const response=await fetch('/api/notifications/preferences',{cache:'no-store'});const result=await response.json();
        if(!live)return;if(!response.ok)throw new Error(result.error||t('notifications.loadError'));
        setPreferences(result.data||defaults);setVapidKey(result.vapidPublicKey||'');
        const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
        if(!supported){setSupport('unsupported');return}
        if(isIOS()&&!standalone()){setSupport('install-required');return}
        if(!result.vapidPublicKey){setSupport('missing-config');return}
        setPermission(Notification.permission);
        const registration=await navigator.serviceWorker.getRegistration('/');
        const subscription=await registration?.pushManager.getSubscription();setSubscribed(Boolean(subscription));setSupport('ready');
      }catch(error){if(live){setSupport('unsupported');setMessage(error instanceof Error?error.message:t('notifications.loadError'))}}
    }
    void load();return()=>{live=false};
  },[t]);

  const statusText=useMemo(()=>support==='checking'?t('notifications.checking'):support==='unsupported'?t('notifications.unsupported'):support==='install-required'?t('notifications.installRequired'):support==='missing-config'?t('notifications.missingConfig'):permission==='denied'?t('notifications.denied'):active?t('notifications.active'):t('notifications.inactive'),[support,permission,active,t]);

  async function save(next=preferences){
    const response=await fetch('/api/notifications/preferences',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(next)});const result=await response.json();
    if(!response.ok)throw new Error(result.error||t('notifications.saveError'));
  }
  async function enable(){
    if(support!=='ready'||!vapidKey)return;setBusy(true);setMessage('');
    try{
      const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;
      const nextPermission=await Notification.requestPermission();setPermission(nextPermission);
      if(nextPermission!=='granted')throw new Error(t('notifications.permissionRequired'));
      let subscription=await registration.pushManager.getSubscription();
      if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(vapidKey) as BufferSource});
      const response=await fetch('/api/notifications/subscriptions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(subscription.toJSON())});const result=await response.json();
      if(!response.ok)throw new Error(result.error||t('notifications.subscriptionError'));
      const next={...preferences,enabled:true};await save(next);setPreferences(next);setSubscribed(true);setMessage(t('notifications.enabled'));
    }catch(error){setMessage(error instanceof Error?error.message:t('notifications.subscriptionError'))}finally{setBusy(false)}
  }
  async function disable(){
    setBusy(true);setMessage('');
    try{
      const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();
      if(subscription){await fetch(`/api/notifications/subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`,{method:'DELETE'});await subscription.unsubscribe()}
      const next={...preferences,enabled:false};await save(next);setPreferences(next);setSubscribed(false);setMessage(t('notifications.disabled'));
    }catch(error){setMessage(error instanceof Error?error.message:t('notifications.saveError'))}finally{setBusy(false)}
  }
  function toggleThreshold(key:'budgetThresholds'|'goalThresholds',value:Threshold){
    setPreferences(current=>{const selected=current[key];if(selected.includes(value)&&selected.length===1){setMessage(t('notifications.oneThreshold'));return current}return {...current,[key]:selected.includes(value)?selected.filter(item=>item!==value):[...selected,value].sort((a,b)=>a-b)}});
  }
  async function savePreferences(){setBusy(true);setMessage('');try{await save();setMessage(t('notifications.saved'))}catch(error){setMessage(error instanceof Error?error.message:t('notifications.saveError'))}finally{setBusy(false)}}

  return <>
    <BackToAccount/>
    <header className="page-head"><div><h1>{t('notifications.title')}</h1><p>{t('notifications.subtitle')}</p></div></header>
    <section className="section surface notification-permission-card">
      <div className={`notification-status ${active?'active':''}`}><span><Icon name="settings" size={21}/></span><div><b>{statusText}</b><small>{support==='install-required'?t('notifications.installHelp'):t('notifications.permissionHelp')}</small></div></div>
      {support==='ready'&&permission!=='denied'&&(active?<button type="button" className="secondary" disabled={busy} onClick={disable}>{busy?t('common.loading'):t('notifications.turnOff')}</button>:<button type="button" disabled={busy} onClick={enable}>{busy?t('common.loading'):t('notifications.turnOn')}</button>)}
      {permission==='denied'&&<p className="notification-help">{t('notifications.deniedHelp')}</p>}
    </section>

    <section className="section surface notification-preferences">
      <div className="section-title"><div><h2>{t('notifications.budgetTitle')}</h2><small>{t('notifications.budgetHelp')}</small></div><label className="mini-switch"><input type="checkbox" checked={preferences.budgetEnabled} onChange={event=>setPreferences(current=>({...current,budgetEnabled:event.target.checked}))}/><span aria-hidden="true"/></label></div>
      <div className="threshold-picker" aria-label={t('notifications.budgetThresholds')}>{thresholds.map(value=><button type="button" key={value} className={preferences.budgetThresholds.includes(value)?'selected':''} aria-pressed={preferences.budgetThresholds.includes(value)} disabled={!preferences.budgetEnabled} onClick={()=>toggleThreshold('budgetThresholds',value)}>{value}%</button>)}</div>
    </section>

    <section className="section surface notification-preferences">
      <div className="section-title"><div><h2>{t('notifications.goalsTitle')}</h2><small>{t('notifications.goalsHelp')}</small></div><label className="mini-switch"><input type="checkbox" checked={preferences.goalsEnabled} onChange={event=>setPreferences(current=>({...current,goalsEnabled:event.target.checked}))}/><span aria-hidden="true"/></label></div>
      <div className="threshold-picker" aria-label={t('notifications.goalThresholds')}>{thresholds.map(value=><button type="button" key={value} className={preferences.goalThresholds.includes(value)?'selected':''} aria-pressed={preferences.goalThresholds.includes(value)} disabled={!preferences.goalsEnabled} onClick={()=>toggleThreshold('goalThresholds',value)}>{value}%</button>)}</div>
      <p className="notification-help">{t('notifications.familyHelp')}</p>
    </section>
    <button type="button" className="save-btn notification-save" disabled={busy} onClick={savePreferences}>{busy?t('common.saving'):t('notifications.save')}</button>
    {message&&<div className="notice" role="status">{message}</div>}
  </>;
}
