// Service worker mínimo de Green Tech.
// Red primero; si no hay internet, sirve la última copia guardada del sitio.
// Las peticiones a Firebase y a otras APIs no se interceptan.
const CACHE = 'green-tech-v3';

// Al instalar se guarda el HTML de inicio y los archivos que enlaza (JS, CSS,
// manifest, iconos). Sin esto, la primera visita no deja nada en caché porque
// esos archivos se descargan antes de que el service worker exista.
async function precache() {
  const cache = await caches.open(CACHE);
  const scope = self.registration.scope;
  const res = await fetch(scope, { cache: 'reload' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put(scope, res);
  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => new URL(m[1], scope).href)
    .filter((u) => u.startsWith(scope));
  await cache.addAll([...new Set(urls)]);

  // Archivos que el JS/CSS importa (p. ej. el logo SVG) y que no aparecen en el HTML.
  const assets = new Set();
  for (const u of urls.filter((x) => /\.(js|css)$/.test(x))) {
    const text = await (await cache.match(u)).text();
    for (const m of text.matchAll(/assets\/[\w.-]+\.(?:svg|png|jpe?g|webp|woff2?)/g)) {
      assets.add(new URL(m[0], scope).href);
    }
  }
  await cache.addAll([...assets]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreVary: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match(self.registration.scope) : undefined))
          .then((hit) => hit || Response.error()),
      ),
  );
});
