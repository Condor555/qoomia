'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import Icon from './Icon';
import {useI18n} from './LanguageProvider';

const visibleRoutes=new Set(['/','/movimenti']);

export default function TransactionFab(){
  const pathname=usePathname();
  const {t}=useI18n();
  if(!visibleRoutes.has(pathname))return null;

  return <Link href="/nuovo" className="transaction-fab" aria-label={t('nav.addMovement')}>
    <span className="transaction-fab-icon" aria-hidden="true"><Icon name="plus" size={21}/></span>
    <span>{t('nav.addMovement')}</span>
  </Link>;
}
