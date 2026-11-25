import {findIconEntry} from './category-icon-catalog';

/**
 * Restituisce soltanto asset presenti nell'allow-list del catalogo: file locali
 * oppure i due URL Icons8 approvati per Barbiere e Divertimento.
 * null significa fallback Phosphor Tag; nessun valore salvato diventa un URL.
 */
export function categoryIconAsset(icon?:string|null){
  return findIconEntry(icon)?.asset||null;
}
