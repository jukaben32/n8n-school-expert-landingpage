// sw.js — service worker "de reemplazo"
//
// La landing vieja (index.html en la raíz del repo, antes de que
// existiera esta app) registraba un service worker con estrategia
// "caché primero": una vez instalado en el navegador de alguien,
// servía el sitio guardado para siempre, sin importar qué cambiara
// en el servidor -- ni recargar con Ctrl+Shift+R lo destraba.
//
// Cualquier persona que haya visitado la landing vieja antes de este
// despliegue tiene ese service worker atascado. Este archivo ocupa la
// MISMA ruta (/sw.js), así que el navegador lo detecta como una
// actualización del que ya tenía instalado, lo activa, y este se
// autodestruye: borra todos los cachés viejos y se desregistra a sí
// mismo. La próxima navegación ya sale directo a la red, sin caché.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => {
        clients.forEach((client) => client.navigate(client.url))
      })
  )
})
