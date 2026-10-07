var CACHE = "fba-calc-motor-scoring-v1-20261006-33";
var ASSETS = [
  "./",
  "./index.html",
  "./jev-v1.js",
  "./jev-phase2.js",
  "./jev-phase3.js",
  "./jev-phase4-market.js",
  "./jev-phase5-rotation-risk.js",
  "./jev-phase6-engine.js",
  "./operations-v1.js?v=32",
  "./jev-financial-sync.js?v=33",
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

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);

  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request, {cache:"no-store"}).then(function (res) {
      return res.text().then(function (html) {
        if (html.indexOf("jev-financial-sync.js") < 0) {
          html = html.replace("</body>", '<script src="jev-financial-sync.js?v=33"></script></body>');
        }
        return new Response(html, {status:res.status,statusText:res.statusText,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
      });
    }).catch(function () { return caches.match("./index.html"); }));
    return;
  }

  if (url.pathname.endsWith("/operations-v1.js")) {
    var freshOps = new Request("./operations-v1.js?v=32", {cache:"no-store"});
    e.respondWith(fetch(freshOps).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put("./operations-v1.js?v=32", copy); });
      return res;
    }).catch(function () { return caches.match("./operations-v1.js?v=32"); }));
    return;
  }

  if (url.pathname.endsWith("/jev-financial-sync.js")) {
    var freshSync = new Request("./jev-financial-sync.js?v=33", {cache:"no-store"});
    e.respondWith(fetch(freshSync).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put("./jev-financial-sync.js?v=33", copy); });
      return res;
    }).catch(function () { return caches.match("./jev-financial-sync.js?v=33"); }));
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