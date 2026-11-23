'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import AdaptiveSheet from '../../../components/AdaptiveSheet';
import NewTransactionComposer from '../../../components/NewTransactionComposer';

export default function NewTransactionModal(){
  const router=useRouter();
  const [dirty,setDirty]=useState(false);
  return <AdaptiveSheet open onClose={()=>router.back()} title="Nuovo movimento" eyebrow="Movimenti" size="full" closeLabel="Chiudi nuovo movimento" dirty={dirty}>
    <NewTransactionComposer embedded onDirtyChange={setDirty} onSaved={()=>router.back()}/>
  </AdaptiveSheet>;
}
