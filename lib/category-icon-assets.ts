import {findIconEntry} from './category-icon-catalog';

/**
 * Restituisce soltanto asset allow-list da public/icons/categories o brands.
 * null significa fallback Phosphor Tag; nessun valore salvato diventa un URL.
 */
export function categoryIconAsset(icon?:string|null){
  return findIconEntry(icon)?.asset||null;
}


