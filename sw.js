var CACHE = "fba-calc-motor-scoring-v1-20261007-38";
var ASSETS = [
  "./",
  "./index.html",
  "./jev-v1.js",
  "./jev-phase2.js",
  "./jev-phase3.js",
  "./jev-phase4-market.js",
  "./jev-phase5-rotation-risk.js",
  "./jev-phase6-engine.js",
  "./operations-v1.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function summaryPatch(){
  return `\n;(function(){
    function money(x){return x==null||!isFinite(x)?"—":"$"+Number(x).toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2});}
    function pct(x){return x==null||!isFinite(x)?"—":(Number(x)*100).toFixed(1)+"%";}
    function setCard(card,label,value,sub,tone){if(!card)return;var l=card.querySelector('.l'),v=card.querySelector('.v'),s=card.querySelector('.s');if(l&&label)l.textContent=label;if(v){v.textContent=value;v.className='v '+(tone||'');}if(s&&sub!=null)s.textContent=sub;}
    function syncSummary(){
      var e=window.MOTOR_SCORING_ENGINE,o=document.getElementById('p_out');
      if(!e||!o||!e.financial||!e.financial.complete)return;
      var f=e.financial,c=e.capital||{},groups=o.querySelectorAll('.stats');
      if(groups[0]){
        var a=groups[0].querySelectorAll('.stat');
        setCard(a[0],'GANANCIA NETA',money(f.net),'Resumen Motor Scoring',f.net<=0?'bad':'');
        setCard(a[1],'MARGEN',pct(f.margin),'Resumen Motor Scoring',f.margin<.08?'bad':(f.margin<.15?'warn':''));
        setCard(a[2],'ROI',pct(f.roi),'Resumen Motor Scoring',f.roi<.10?'bad':(f.roi<.30?'warn':''));
      }
      if(groups[1]){
        var b=groups[1].querySelectorAll('.stat'),budget=Number((document.getElementById('p_presu')||{}).value)||0;
        var capital=c.requestedCapital!=null?Number(c.requestedCapital):(f.landed!=null?(Number(f.landed)*(Number((document.getElementById('p_unid')||{}).value)||0)):null);
        var free=capital==null?null:budget-capital;
        setCard(b[0],'CAPITAL COMPROMETIDO',money(capital),'Costo real del lote',capital!=null&&budget>0&&capital/budget>.6?'warn':'');
        setCard(b[1],'CAPITAL LIBRE',money(free),'Presupuesto − capital comprometido',free!=null&&free<0?'bad':'');
        setCard(b[2],'COSTO REAL / U',money(f.landed),'Landed cost usado por Motor Scoring','');
        setCard(b[3],'PRECIO MÍNIMO',money(f.breakEven),'Break-even real','');
      }
    }
    function schedule(){setTimeout(syncSummary,0);setTimeout(syncSummary,50);}
    function start(){schedule();var t=document.getElementById('jev_final_decision');if(t&&window.MutationObserver)new MutationObserver(schedule).observe(t,{childList:true,subtree:true,characterData:true});document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);window.addEventListener('motor-scoring-state-changed',schedule);}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,20)});else setTimeout(start,20);
  })();`;
}

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);

  if (url.pathname.endsWith("/jev-phase6-engine.js")) {
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(function(res){
      return res.text().then(function(js){
        return new Response(js + summaryPatch(), {status:res.status,statusText:res.statusText,headers:{"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"no-store"}});
      });
    }).catch(function(){return caches.match("./jev-phase6-engine.js");}));
    return;
  }

  e.respondWith(
    fetch(e.request, {cache:"no-store"}).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (r) {
        return r || caches.match("./index.html");
      });
    })
  );
});