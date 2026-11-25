import {findIconEntry} from './category-icon-catalog';

/**
 * Restituisce soltanto asset locali presenti nell'allow-list del catalogo.
 * null significa fallback Phosphor Tag; nessun valore salvato diventa un URL.
 */
export function categoryIconAsset(icon?:string|null){
  return findIconEntry(icon)?.asset||null;
}
