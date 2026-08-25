const CACHE_NAME='arc-tilt-poc-v40';
const APP_SHELL=[
  './','./index.html','./manifest.webmanifest?v=40',
  './css/tilt.css?v=40','./css/field.css?v=40','./css/arc40.css?v=40',
  './assets/arc-header.svg?v=13',
  './js/tilt_protocol.js?v=40','./js/tilt_templates.js?v=40','./js/tilt_store.js?v=40','./js/tilt_db.js?v=40',
  './js/tilt_engine.js?v=40','./js/arc_device_diagnostics.js?v=40','./js/tilt_simulator.js?v=40',
  './js/tilt_ble_bridge.js?v=40','./js/tilt_record_adapter.js?v=40','./js/app.js?v=40','./js/arc_recovery.js?v=40'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
  const networkFirst=e.request.mode==='navigate'||u.pathname.endsWith('.js')||u.pathname.endsWith('.css')||u.pathname.endsWith('.html');
  if(networkFirst){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r?.ok)caches.open(CACHE_NAME).then(c=>c.put(e.request,r.clone()));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{if(n?.ok)caches.open(CACHE_NAME).then(c=>c.put(e.request,n.clone()));return n;})));
});
