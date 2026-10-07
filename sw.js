var CACHE = "fba-calc-motor-scoring-v1-20261006-31";
var ASSETS = [
  "./",
  "./index.html",
  "./jev-v1.js",
  "./jev-phase2.js",
  "./jev-phase3.js",
  "./jev-phase4-market.js",
  "./jev-phase5-rotation-risk.js",
  "./jev-phase6-engine.js",
  "./operations-v1.js?v=31",
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
  if (url.pathname.endsWith("/operations-v1.js")) {
    var fresh = new Request("./operations-v1.js?v=31", {cache:"no-store"});
    e.respondWith(fetch(fresh).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put("./operations-v1.js?v=31", copy); });
      return res;
    }).catch(function () {
      return caches.match("./operations-v1.js?v=31");
    }));
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