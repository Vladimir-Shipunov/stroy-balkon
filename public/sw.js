// Простой Service Worker (пустой, но существующий)
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    // Просто пропускаем все запросы
});
