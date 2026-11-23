'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import Icon from './Icon';
import {useI18n} from './LanguageProvider';

const visibleRoutes=new Set(['/','/movimenti']);
const COLLAPSE_AT=96;
const EXPAND_AT=48;

export default function FloatingAddMovement(){
  const pathname=usePathname();
  const {t}=useI18n();
  const [collapsed,setCollapsed]=useState(false);

  useEffect(()=>{
    if(!visibleRoutes.has(pathname))return;
    let frame=0;
    const update=()=>{
      frame=0;
      const y=window.scrollY;
      setCollapsed(current=>current?y>EXPAND_AT:y>COLLAPSE_AT);
    };
    const onScroll=()=>{
      if(!frame)frame=window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll',onScroll,{passive:true});
    return()=>{
      window.removeEventListener('scroll',onScroll);
      if(frame)window.cancelAnimationFrame(frame);
    };
  },[pathname]);

  if(!visibleRoutes.has(pathname))return null;

  return <Link
    href="/nuovo"
    className={`floating-add-movement${collapsed?' is-collapsed':''}`}
    aria-label={t('nav.newTransaction')}
    title={t('nav.newTransaction')}
  >
    <span className="floating-add-icon"><Icon name="plus" size={25}/></span>
    <span className="floating-add-label">{t('nav.addMovement')}</span>
  </Link>;
}
