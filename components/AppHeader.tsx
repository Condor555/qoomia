'use client';
import {usePathname} from 'next/navigation';
import SpaceSwitcher from './SpaceSwitcher';

export default function AppHeader(){
  const pathname=usePathname();
  const hidden =
    pathname === '/login' ||
    pathname === '/registrati' ||
    pathname === '/onboarding' ||
    pathname === '/nuovo' ||
    pathname === '/importa' ||
    pathname === '/account' ||
    pathname.startsWith('/account/') ||
    pathname === '/spazi' ||
    pathname === '/obiettivi';

  if(hidden) return null;
  return <SpaceSwitcher/>;
}
