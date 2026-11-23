'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {BellIcon,InfoIcon} from '@phosphor-icons/react/ssr';
import {createClient} from '../../lib/supabase/client';
import Icon,{type IconName} from '../../components/Icon';
import {useI18n} from '../../components/LanguageProvider';
import type {TranslationKey} from '../../lib/i18n';

type SettingsItem={href:string;icon:IconName|'bell'|'info';title:TranslationKey;sub:TranslationKey};

const items:SettingsItem[]=[
  {href:'/account/profilo',icon:'user',title:'account.profileTitle',sub:'account.profileSub'},
  {href:'/account/conto',icon:'wallet',title:'account.walletTitle',sub:'account.walletSub'},
  {href:'/account/aspetto',icon:'sun',title:'account.appearanceTitle',sub:'account.appearanceSub'},
  {href:'/account/categorie',icon:'category',title:'account.categoriesTitle',sub:'account.categoriesSub'},
  {href:'/account/ricorrenze',icon:'repeat',title:'account.recurringTitle',sub:'account.recurringSub'},
  {href:'/account/notifiche',icon:'bell',title:'account.notificationsTitle',sub:'account.notificationsSub'},
  {href:'/spazi',icon:'family',title:'account.spacesTitle',sub:'account.spacesSub'},
  {href:'/account/dati',icon:'download',title:'account.dataTitle',sub:'account.dataSub'},
  {href:'/account/informazioni',icon:'info',title:'account.infoTitle',sub:'account.infoSub'},
];

function SettingsIcon({name}:{name:SettingsItem['icon']}){
  if(name==='info')return <InfoIcon size={22} weight="regular" aria-hidden="true"/>;
  if(name==='bell')return <BellIcon size={22} weight="regular" aria-hidden="true"/>;
  return <Icon name={name}/>;
}

export default function Impostazioni(){
  const router=useRouter();
  const {t}=useI18n();
  async function logout(){await createClient().auth.signOut();router.replace('/login');router.refresh()}
  return <>
    <header className="page-head"><div><h1>{t('account.title')}</h1><p>{t('account.subtitle')}</p></div></header>
    <section className="profile-menu surface">{items.map(item=><Link key={item.href} href={item.href} className="profile-menu-row"><span className="profile-menu-icon"><SettingsIcon name={item.icon}/></span><div><b>{t(item.title)}</b><small>{t(item.sub)}</small></div><strong>›</strong></Link>)}</section>
    <button className="danger profile-logout" onClick={logout}><Icon name="logout" size={18}/> {t('account.logout')}</button>
  </>;
}
