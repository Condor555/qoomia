'use client';

import {useState,type ReactEventHandler} from 'react';
import {TagIcon} from '@phosphor-icons/react/ssr';
import {categoryIconAsset} from '../lib/category-icon-assets';

type VisualProps={src:string|null;ready:boolean;size:number;className?:string;onError:ReactEventHandler<HTMLImageElement>};

export function CategoryIconVisual({src,ready,size,className,onError}:VisualProps){
  const classNames=`category-color-icon${className?` ${className}`:''}`;
  if(!ready||!src)return <TagIcon className={`${classNames} category-color-fallback`} size={size} weight="duotone" aria-hidden="true"/>;
  return <img className={classNames} src={src} width={size} height={size} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={onError}/>;
}

/**
 * Renderizza subito l'asset locale. Il browser gestisce caricamento e cache;
 * onError passa al fallback senza il precedente doppio caricamento new Image().
 */
export default function CategoryColorIcon({icon,size=24,className}:{icon?:string|null;size?:number;className?:string}){
  const src=categoryIconAsset(icon);
  const [failedSrc,setFailedSrc]=useState<string|null>(null);
  const ready=Boolean(src&&failedSrc!==src);
  return <CategoryIconVisual src={src} ready={ready} size={size} className={className} onError={()=>setFailedSrc(src)}/>;
}
