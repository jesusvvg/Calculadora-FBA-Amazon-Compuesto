var CACHE = "fba-calc-motor-scoring-v1-20261007-39";
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
  "./jev-financial-sync.js?v=39",
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