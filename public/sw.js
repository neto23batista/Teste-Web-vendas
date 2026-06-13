/* Service worker do FarmaVida — instalabilidade do PWA.
 *
 * IMPORTANTE: este SW **não tem handler de fetch** de propósito.
 * Qualquer fetch handler (mesmo 100% passthrough) faz as SERVER ACTIONS do
 * Next travarem no Chromium: o POST responde 200, mas o corpo (RSC streaming)
 * nunca conclui — testado empiricamente neste projeto (Edge/Chromium).
 * O Chrome moderno não exige fetch handler para o prompt de instalação:
 * manifest válido + ícones + SW registrado bastam.
 *
 * Se um dia for adicionar cache offline aqui, TESTE uma server action
 * (ex.: enviar avaliação) antes de publicar.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
