'use client';

import {useEffect,useRef,useState} from 'react';
import SpacePicker,{type SpacePickerOption} from './SpacePicker';
import {announceActiveSpace} from '../lib/active-space-client';
import {useI18n} from './LanguageProvider';
import {cachedJson,invalidateClientJson,primeClientJson} from '../lib/client-json-cache';

type Space=SpacePickerOption;

export default function SpaceSwitcher(){
  const {t}=useI18n();
  const [spaces,setSpaces]=useState<Space[]>([]);
  const [active,setActive]=useState('');
  const [ready,setReady]=useState(false);
  const [changing,setChanging]=useState(false);
  const [error,setError]=useState('');
  const requestRef=useRef(0);
  const announcedRef=useRef('');

  useEffect(()=>{
    let live=true;
    setReady(false);
    const applyResult=(result:{data?:Space[];activeSpaceId?:string})=>{
      if(!live)return;
      const list:Space[]=result.data||[];
      const initialSpaceId=result.activeSpaceId||list.find(space=>space.type==='personal')?.id||list[0]?.id||'';
      setSpaces(list);
      setActive(initialSpaceId);
      if(initialSpaceId&&announcedRef.current!==initialSpaceId){
        announcedRef.current=initialSpaceId;
        localStorage.setItem('active_space',initialSpaceId);
        requestAnimationFrame(()=>announceActiveSpace(initialSpaceId));
      }
    };
    cachedJson<{data?:Space[];activeSpaceId?:string}>('/api/spaces',{onRevalidate:applyResult})
      .then(applyResult)
      .catch(()=>{if(live)setError(t('space.loadError'))})
      .finally(()=>{if(live)setReady(true)});
    return()=>{live=false};
  },[t]);

  async function choose(id:string){
    if(id===active||changing)return;
    const request=++requestRef.current;
    const previous=active;
    setActive(id);
    setChanging(true);
    setError('');
    try{
      const response=await fetch('/api/spaces/select',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({spaceId:id}),
      });
      const result=await response.json();
      if(request!==requestRef.current)return;
      if(!response.ok){setActive(previous);setError(result.error||t('space.changeError'));return;}
      localStorage.setItem('active_space',id);
      announcedRef.current=id;
      // The endpoint includes activeSpaceId, so keep the shared GET cache in
      // sync and clear data tied to the previously selected space.
      primeClientJson('/api/spaces',{data:spaces,activeSpaceId:id});
      invalidateClientJson('/api/stats','/api/trends','/api/transactions','/api/categories','/api/members','/api/budgets');
      announceActiveSpace(id);
    }catch{
      if(request===requestRef.current){setActive(previous);setError(t('common.connectionError'));}
    }finally{
      if(request===requestRef.current)setChanging(false);
    }
  }

  if(!ready)return <div className="app-space-bar"><span className="space-picker-loading" aria-live="polite">{t('space.loading')}</span></div>;
  if(!spaces.length)return null;

  return <div className="app-space-bar" title={error||undefined}>
    <SpacePicker spaces={spaces} value={active} onChange={choose} variant="compact" disabled={changing}/>
  </div>;
}
