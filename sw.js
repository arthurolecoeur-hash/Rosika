const C="rosika-v5";
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==location.origin)return;
  if(r.mode==="navigate")return e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(C).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r)));
  if(/\/(art|cut|packs|icons|vendor)\//.test(u.pathname))e.respondWith(caches.open(C).then(x=>x.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok)x.put(r,res.clone());return res}))));
});
