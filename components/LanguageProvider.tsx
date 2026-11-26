'use client';

import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {DEFAULT_LOCALE,LOCALE_STORAGE_KEY,formatCurrency,formatDate,localeTag,normalizeLocale,translate,type Locale,type TranslationKey} from '../lib/i18n';
import {cachedJson,primeClientJson} from '../lib/client-json-cache';

type I18nContextValue={
  locale:Locale;
  localeTag:string;
  t:(key:TranslationKey,variables?:Record<string,string|number>)=>string;
  currency:(value:number)=>string;
  date:(value:string|Date,options?:Intl.DateTimeFormatOptions)=>string;
  setLocale:(locale:Locale)=>Promise<boolean>;
};

const I18nContext=createContext<I18nContextValue|null>(null);

function applyDocumentLocale(locale:Locale){
  document.documentElement.lang=locale;
  document.documentElement.dataset.locale=locale;
}

export default function LanguageProvider({children}:{children:React.ReactNode}){
  const [locale,setLocaleState]=useState<Locale>(DEFAULT_LOCALE);

  useEffect(()=>{
    let live=true;
    const stored=normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
    setLocaleState(stored);applyDocumentLocale(stored);
    cachedJson<{data?:{language?:string}}>('/api/settings/profile')
      .then(result=>{
        if(!live||!result?.data?.language)return;
        const serverLocale=normalizeLocale(result.data.language);
        localStorage.setItem(LOCALE_STORAGE_KEY,serverLocale);
        setLocaleState(serverLocale);applyDocumentLocale(serverLocale);
      })
      .catch(()=>{});
    return()=>{live=false};
  },[]);

  const setLocale=useCallback(async(next:Locale)=>{
    const normalized=normalizeLocale(next);const previous=locale;
    setLocaleState(normalized);localStorage.setItem(LOCALE_STORAGE_KEY,normalized);applyDocumentLocale(normalized);
    try{
      const response=await fetch('/api/settings/profile',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({language:normalized})});
      if(!response.ok)throw new Error('language-save-failed');
      primeClientJson('/api/settings/profile',{data:{language:normalized}});
      return true;
    }catch{
      setLocaleState(previous);localStorage.setItem(LOCALE_STORAGE_KEY,previous);applyDocumentLocale(previous);return false;
    }
  },[locale]);

  const value=useMemo<I18nContextValue>(()=>({
    locale,localeTag:localeTag(locale),
    t:(key,variables)=>translate(locale,key,variables),
    currency:value=>formatCurrency(value,locale),
    date:(value,options)=>formatDate(value,locale,options),
    setLocale,
  }),[locale,setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(){
  const value=useContext(I18nContext);
  if(!value)throw new Error('useI18n must be used inside LanguageProvider');
  return value;
}
