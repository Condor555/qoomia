'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ArrowsDownUpIcon} from '@phosphor-icons/react/ssr';
import Icon, {type IconName} from './Icon';
import QoomiaLogo from './QoomiaLogo';
import {useI18n} from './LanguageProvider';
import {cachedJson} from '../lib/client-json-cache';
import {useSharedMonth} from '../lib/selected-period-client';

type NavigationTab = {
  href: string;
  label: 'nav.home'|'nav.movements'|'nav.budget'|'nav.statistics'|'nav.settings';
  icon: IconName | 'movements';
  isActive: (pathname: string) => boolean;
};

const navigationTabs: NavigationTab[] = [
  {
    href: '/',
    label: 'nav.home',
    icon: 'home',
    isActive: (pathname) => pathname === '/' || pathname === '/obiettivi' || pathname.startsWith('/obiettivi/'),
  },
  {
    href: '/movimenti',
    label: 'nav.movements',
    icon: 'movements',
    isActive: (pathname) =>
      pathname === '/movimenti' || pathname.startsWith('/movimenti/'),
  },
  {
    href: '/budget',
    label: 'nav.budget',
    icon: 'wallet',
    isActive: (pathname) =>
      pathname === '/budget' || pathname.startsWith('/budget/'),
  },
  {
    href: '/statistiche',
    label: 'nav.statistics',
    icon: 'chart',
    isActive: (pathname) =>
      pathname === '/statistiche' ||
      pathname.startsWith('/statistiche/'),
  },
  {
    href: '/account',
    label: 'nav.settings',
    icon: 'settings',
    isActive: (pathname) =>
      pathname === '/account' ||
      pathname.startsWith('/account/') ||
      pathname === '/spazi' ||
      pathname.startsWith('/spazi/') ||
      pathname === '/importa' ||
      pathname.startsWith('/importa/'),
  },
];

const hiddenRoutes = new Set(['/login', '/registrati', '/onboarding']);

function NavigationIcon({icon}: {icon: NavigationTab['icon']}) {
  if (icon === 'movements') {
    return <ArrowsDownUpIcon size={22} weight="regular" aria-hidden="true" />;
  }

  return <Icon name={icon} />;
}

export default function Nav() {
  const pathname = usePathname();
  const {t}=useI18n();
  const {month}=useSharedMonth();

  const warmRoute=(href:string)=>{
    const requests:Promise<unknown>[]=[];
    if(href==='/'||href==='/statistiche')requests.push(cachedJson(`/api/stats?month=${encodeURIComponent(month)}`));
    if(href==='/statistiche')requests.push(cachedJson(`/api/trends?month=${encodeURIComponent(month)}&months=6`));
    if(href==='/budget')requests.push(cachedJson(`/api/budgets?month=${encodeURIComponent(month)}`));
    if(href==='/movimenti')requests.push(
      cachedJson('/api/transactions?page=1&size=30'),
      cachedJson('/api/categories'),
      cachedJson('/api/members'),
    );
    for(const request of requests)void request.catch(()=>{});
  };

  if (hiddenRoutes.has(pathname)) return null;

  const renderTab = (tab: NavigationTab) => {
    const active = tab.isActive(pathname);

    return (
      <Link
        key={tab.href}
        href={tab.href}
        prefetch
        onPointerEnter={()=>warmRoute(tab.href)}
        onFocus={()=>warmRoute(tab.href)}
        onTouchStart={()=>warmRoute(tab.href)}
        className={active ? 'active' : undefined}
        aria-current={active ? 'page' : undefined}
      >
        <span className="nav-tab-icon">
          <NavigationIcon icon={tab.icon} />
        </span>
        <span>{t(tab.label)}</span>
      </Link>
    );
  };

  return (
    <nav className="bottom-nav" aria-label={t('nav.main')}>
      <Link className="nav-brand-lockup" href="/" aria-label="Qoomia Home">
        <QoomiaLogo size={36}/>
        <strong>Qoomia</strong>
      </Link>
      {navigationTabs.map(renderTab)}
      <div className="nav-clarity-card" aria-hidden="true">
        <span><Icon name="chart" size={18}/></span>
        <strong>Le tue finanze,<br/>sempre più chiare.</strong>
        <p>Dati reali, budget e obiettivi nello spazio che scegli.</p>
      </div>
    </nav>
  );
}
