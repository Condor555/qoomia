'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import QoomiaLogo from './QoomiaLogo';
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
  return <header className="app-topbar">
    <Link className="app-topbar-brand" href="/" aria-label="Qoomia Home"><QoomiaLogo size={34}/><strong>Qoomia</strong></Link>
    <SpaceSwitcher/>
  </header>;
}
