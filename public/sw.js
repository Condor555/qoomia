/* Qoomia Web Push service worker */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
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
  const target=new URL(event.notification.data?.url||'/',self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    const existing=clients.find(client=>client.url===target);
    if(existing){existing.focus();return existing.navigate(target)}
    return self.clients.openWindow(target);
  }));
});
