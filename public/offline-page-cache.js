(() => {
  if (!("serviceWorker" in navigator)) return;

  async function cacheCurrentPage() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller || registration.active || registration.waiting;
      if (!worker) return;
      worker.postMessage({ type: "CACHE_PAGE", url: window.location.pathname + window.location.search });
    } catch {}
  }

  window.addEventListener("load", cacheCurrentPage);
  navigator.serviceWorker.addEventListener("controllerchange", cacheCurrentPage);
})();
