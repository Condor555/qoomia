'use client';

type Entry={data:unknown;updatedAt:number;inflight?:Promise<unknown>};
type Options<T>={ttl?:number;signal?:AbortSignal;force?:boolean;onRevalidate?:(value:T)=>void};
const entries=new Map<string,Entry>();
const DEFAULT_TTL=20_000;

async function request<T>(url:string){
  // Shared requests are intentionally not tied to a page AbortSignal: navigation may reuse the same promise.
  const response=await fetch(url,{cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw new Error(result?.error||'Request failed');
  return result as T;
}

export async function cachedJson<T>(url:string,{ttl=DEFAULT_TTL,signal,force=false,onRevalidate}:Options<T>={}):Promise<T>{
  const now=Date.now();const existing=entries.get(url);
  if(!force&&existing?.data!==undefined&&now-existing.updatedAt<ttl)return existing.data as T;
  if(!force&&existing?.data!==undefined){
    if(!existing.inflight){
      existing.inflight=request<T>(url).then(value=>{entries.set(url,{data:value,updatedAt:Date.now()});onRevalidate?.(value);return value}).catch(()=>existing.data).finally(()=>{const current=entries.get(url);if(current)delete current.inflight});
    }
    return existing.data as T;
  }
  if(existing?.inflight)return existing.inflight as Promise<T>;
  const inflight=request<T>(url).then(value=>{entries.set(url,{data:value,updatedAt:Date.now()});return value}).finally(()=>{const current=entries.get(url);if(current)delete current.inflight});
  entries.set(url,{data:existing?.data,updatedAt:existing?.updatedAt||0,inflight});
  return inflight;
}

export function invalidateClientJson(...prefixes:string[]){
  for(const key of entries.keys())if(prefixes.some(prefix=>key.startsWith(prefix)))entries.delete(key);
}

export function primeClientJson<T>(url:string,value:T){entries.set(url,{data:value,updatedAt:Date.now()})}
