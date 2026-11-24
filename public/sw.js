/* Qoomia PWA + Web Push service worker.
 * Cache only public static assets: financial pages and API responses always stay network-only.
 */
const CACHE_NAME='qoomia-static-v4.1.6-pwa1';
const CACHE_PREFIX='qoomia-static-';
const PRECACHE=[
  '/offline.html',
  '/manifest.webmanifest',
  '/apple-icon.png',
  '/icons/qoomia-v4-1-192.png',
  '/icons/qoomia-v4-1-512.png',
  '/icons/qoomia-v4-1-512-maskable.png',
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  /* Never cache authenticated HTML or JSON. Show only the neutral offline page when navigation fails. */
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('/offline.html').then(response=>response||Response.error())));
    return;
  }
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))return;

  const isStatic=url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/icons/')||
    ['style','script','image','font'].includes(request.destination);
  if(!isStatic)return;

  const network=fetch(request).then(async response=>{
    if(response.ok&&response.type==='basic'){
      const copy=response.clone();
      const cache=await caches.open(CACHE_NAME);
      await cache.put(request,copy);
    }
    return response;
  });
  event.waitUntil(network.then(()=>undefined).catch(()=>undefined));
  event.respondWith(caches.match(request).then(cached=>cached||network).catch(()=>network));
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()||''}}
  const title=data.title||'Qoomia';
  const options={
    body:data.body||'Hai un nuovo aggiornamento.',
    icon:'/icons/qoomia-v4-1-192.png',
    badge:'/icons/qoomia-v4-1-192.png',
    tag:data.tag||'qoomia-update',
    renotify:false,
    data:{url:data.url||'/'},
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const requested=new URL(event.notification.data?.url||'/',self.location.origin);
  const target=(requested.origin===self.location.origin?requested:new URL('/',self.location.origin)).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    const existing=clients.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing){return existing.navigate(target).then(()=>existing.focus())}
    return self.clients.openWindow(target);
  }));
});
