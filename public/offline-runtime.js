(() => {
  if (typeof window === "undefined" || window.__NEPTUNE_OFFLINE_RUNTIME__) return;
  window.__NEPTUNE_OFFLINE_RUNTIME__ = true;

  const DB_NAME = "neptune-offline-v1";
  const DB_VERSION = 1;
  const RESPONSE_STORE = "responses";
  const QUEUE_STORE = "queue";
  const MAP_STORE = "id_map";
  const originalFetch = window.fetch.bind(window);
  let syncing = false;
  let lastMessage = "";

  const queueablePaths = [
    /^\/api\/v1\/(vessels|duties|work_orders|certificates|incidents|crm_accounts|activity_events|ports|bunker_plans|mrcc_contacts|port_congestion_snapshots)$/,
    /^\/api\/v1\/ev-projects$/,
    /^\/api\/v1\/future-ev\/projects$/,
    /^\/api\/v1\/settings\/duty-options$/
  ];

  const dashboardProperty = {
    vessels: "vessels",
    duties: "duties",
    work_orders: "workOrders",
    certificates: "certificates",
    incidents: "incidents",
    crm_accounts: "crm",
    activity_events: "events",
    ports: "ports",
    bunker_plans: "bunkerPlans",
    mrcc_contacts: "mrccContacts",
    port_congestion_snapshots: "congestionSnapshots"
  };

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(RESPONSE_STORE)) db.createObjectStore(RESPONSE_STORE, { keyPath: "url" });
        if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains(MAP_STORE)) db.createObjectStore(MAP_STORE, { keyPath: "localId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(name, mode, callback) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(name, mode);
      const store = transaction.objectStore(name);
      let result;
      try {
        result = callback(store);
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }).finally(() => db.close());
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getRecord(storeName, key) {
    const db = await openDatabase();
    try {
      const transaction = db.transaction(storeName, "readonly");
      return await requestValue(transaction.objectStore(storeName).get(key));
    } finally {
      db.close();
    }
  }

  async function getAll(storeName) {
    const db = await openDatabase();
    try {
      const transaction = db.transaction(storeName, "readonly");
      return await requestValue(transaction.objectStore(storeName).getAll());
    } finally {
      db.close();
    }
  }

  async function putRecord(storeName, value) {
    const db = await openDatabase();
    try {
      const transaction = db.transaction(storeName, "readwrite");
      await requestValue(transaction.objectStore(storeName).put(value));
    } finally {
      db.close();
    }
  }

  async function addRecord(storeName, value) {
    const db = await openDatabase();
    try {
      const transaction = db.transaction(storeName, "readwrite");
      return await requestValue(transaction.objectStore(storeName).add(value));
    } finally {
      db.close();
    }
  }

  async function deleteRecord(storeName, key) {
    const db = await openDatabase();
    try {
      const transaction = db.transaction(storeName, "readwrite");
      await requestValue(transaction.objectStore(storeName).delete(key));
    } finally {
      db.close();
    }
  }

  async function clearStore(storeName) {
    const db = await openDatabase();
    try {
      const transaction = db.transaction(storeName, "readwrite");
      await requestValue(transaction.objectStore(storeName).clear());
    } finally {
      db.close();
    }
  }

  function absoluteUrl(value) {
    return new URL(value, window.location.origin).toString();
  }

  function shouldCacheGet(url) {
    return url.origin === window.location.origin && url.pathname.startsWith("/api/v1/");
  }

  function isQueueable(url, method) {
    return ["POST", "PATCH", "PUT", "DELETE"].includes(method) && queueablePaths.some(pattern => pattern.test(url.pathname));
  }

  async function cacheResponse(url, response) {
    if (!response.ok || [401, 402, 403].includes(response.status)) return;
    const contentType = response.headers.get("content-type") || "application/json";
    if (!contentType.includes("json") && !contentType.includes("text")) return;
    const body = await response.clone().text();
    await putRecord(RESPONSE_STORE, {
      url: absoluteUrl(url),
      status: response.status,
      statusText: response.statusText,
      contentType,
      body,
      updatedAt: Date.now()
    });
  }

  async function cachedResponse(url) {
    const record = await getRecord(RESPONSE_STORE, absoluteUrl(url));
    if (!record) return null;
    return new Response(record.body, {
      status: record.status || 200,
      statusText: record.statusText || "OK",
      headers: {
        "content-type": record.contentType || "application/json",
        "x-neptune-offline": "1",
        "x-neptune-cached-at": String(record.updatedAt || "")
      }
    });
  }

  async function readCachedJson(url) {
    const record = await getRecord(RESPONSE_STORE, absoluteUrl(url));
    if (!record || !record.body) return null;
    try { return JSON.parse(record.body); } catch { return null; }
  }

  async function writeCachedJson(url, payload) {
    await putRecord(RESPONSE_STORE, {
      url: absoluteUrl(url),
      status: 200,
      statusText: "OK",
      contentType: "application/json",
      body: JSON.stringify(payload),
      updatedAt: Date.now()
    });
  }

  function openStatus(value) {
    return !["closed", "complete", "completed", "resolved", "cancelled", "canceled"].includes(String(value || "").toLowerCase());
  }

  function recalculateDashboard(data) {
    const vessels = data.vessels || [];
    const duties = data.duties || [];
    const workOrders = data.workOrders || [];
    const certificates = data.certificates || [];
    const incidents = data.incidents || [];
    const crm = data.crm || [];
    const ports = data.ports || [];
    const mrccContacts = data.mrccContacts || [];
    const readiness = vessels.length ? Math.round(vessels.reduce((sum, item) => sum + Number(item.readiness || 0), 0) / vessels.length) : 0;
    const expiringCertificates = certificates.filter(item => {
      const explicit = String(item.status || "").toLowerCase().includes("expir");
      const expiry = item.expires_at ? new Date(item.expires_at).getTime() : NaN;
      const days = Number.isFinite(expiry) ? Math.ceil((expiry - Date.now()) / 86400000) : null;
      return explicit || (days !== null && days <= 45);
    }).length;
    const criticalDuties = duties.filter(item => openStatus(item.status) && String(item.severity || "").toLowerCase() === "critical").length;
    const criticalIncidents = incidents.filter(item => openStatus(item.status) && ["critical", "high", "major"].includes(String(item.severity || "").toLowerCase())).length;
    data.kpis = {
      ...(data.kpis || {}),
      vessels: vessels.length,
      readiness,
      openDuties: duties.filter(item => openStatus(item.status)).length,
      openWorkOrders: workOrders.filter(item => openStatus(item.status)).length,
      expiringCertificates,
      openIncidents: incidents.filter(item => openStatus(item.status)).length,
      critical: criticalDuties + criticalIncidents,
      pipeline: crm.reduce((sum, item) => sum + Number(item.annual_value || 0), 0),
      ports: ports.length,
      verifiedMrcc: mrccContacts.filter(item => Boolean(item.verified_at)).length
    };
    return data;
  }

  function localRecord(body, localId) {
    return {
      ...body,
      id: localId,
      created_at: body.created_at || new Date().toISOString(),
      offline_pending: true
    };
  }

  function mutateRows(rows, method, body, localId, deleteId) {
    const current = Array.isArray(rows) ? rows : [];
    if (method === "POST") return [localRecord(body, localId), ...current];
    const targetId = body.id || deleteId;
    if (method === "PATCH" || method === "PUT") return current.map(item => String(item.id) === String(targetId) ? { ...item, ...body, offline_pending: true } : item);
    if (method === "DELETE") return current.filter(item => String(item.id) !== String(targetId));
    return current;
  }

  async function applyOptimisticMutation(url, method, body, localId) {
    const deleteId = url.searchParams.get("id");
    const parts = url.pathname.split("/").filter(Boolean);
    const resource = parts[parts.length - 1];

    if (url.pathname === "/api/v1/settings/duty-options") {
      const existing = await readCachedJson(url.pathname) || {};
      await writeCachedJson(url.pathname, {
        ...existing,
        ...body,
        configuredOwners: body.owners || existing.configuredOwners || [],
        configuredLocations: body.locations || existing.configuredLocations || [],
        owners: body.owners || existing.owners || [],
        locations: body.locations || existing.locations || [],
        isConfigured: true,
        updatedAt: new Date().toISOString(),
        offline_pending: true
      });
      return;
    }

    if (url.pathname === "/api/v1/ev-projects" || url.pathname === "/api/v1/future-ev/projects") {
      const existing = await readCachedJson(url.pathname) || { projects: [] };
      existing.projects = mutateRows(existing.projects, method, body, localId, deleteId);
      await writeCachedJson(url.pathname, existing);
      return;
    }

    const resourceCache = await readCachedJson(url.pathname);
    if (resourceCache && Array.isArray(resourceCache.items)) {
      resourceCache.items = mutateRows(resourceCache.items, method, body, localId, deleteId);
      await writeCachedJson(url.pathname, resourceCache);
    }

    const property = dashboardProperty[resource];
    if (!property) return;
    const dashboardUrl = "/api/v1/dashboard";
    const dashboard = await readCachedJson(dashboardUrl);
    if (!dashboard) return;
    dashboard[property] = mutateRows(dashboard[property], method, body, localId, deleteId);
    recalculateDashboard(dashboard);
    await writeCachedJson(dashboardUrl, dashboard);
  }

  async function pendingCount() {
    const entries = await getAll(QUEUE_STORE);
    return entries.length;
  }

  async function emitStatus(message = lastMessage) {
    lastMessage = message || "";
    const pending = await pendingCount().catch(() => 0);
    window.dispatchEvent(new CustomEvent("neptune-offline-status", {
      detail: { online: navigator.onLine, pending, syncing, message: lastMessage }
    }));
  }

  async function queueMutation(request, url, method) {
    const bodyText = method === "DELETE" ? "" : await request.clone().text();
    let body = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = {}; }
    const localId = method === "POST" ? `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : body.id || url.searchParams.get("id") || null;
    const headers = {};
    request.headers.forEach((value, key) => {
      if (!["content-length", "host", "connection"].includes(key.toLowerCase())) headers[key] = value;
    });

    await addRecord(QUEUE_STORE, {
      url: url.pathname + url.search,
      method,
      headers,
      bodyText,
      localId,
      createdAt: Date.now()
    });
    await applyOptimisticMutation(url, method, body, localId);
    await emitStatus("Changes are stored on this device until a connection is available.");

    const responseBody = method === "DELETE"
      ? { ok: true, offlineQueued: true }
      : { ok: true, offlineQueued: true, item: localRecord(body, localId), project: localRecord(body, localId) };
    return new Response(JSON.stringify(responseBody), {
      status: 202,
      statusText: "Accepted Offline",
      headers: { "content-type": "application/json", "x-neptune-offline-queued": "1" }
    });
  }

  async function mappedId(localId) {
    if (!localId || !String(localId).startsWith("offline_")) return localId;
    const mapped = await getRecord(MAP_STORE, localId);
    return mapped?.serverId || localId;
  }

  async function prepareQueuedRequest(entry) {
    let bodyText = entry.bodyText || "";
    let url = new URL(entry.url, window.location.origin);
    if (bodyText) {
      try {
        const body = JSON.parse(bodyText);
        if (body.id) body.id = await mappedId(body.id);
        delete body.offline_pending;
        if (entry.method === "POST") delete body.id;
        bodyText = JSON.stringify(body);
      } catch {}
    }
    if (entry.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (id) url.searchParams.set("id", await mappedId(id));
    }
    return { url: url.toString(), bodyText };
  }

  async function refreshOfflineSnapshots() {
    const urls = ["/api/v1/dashboard", "/api/v1/settings/duty-options", "/api/v1/ev-projects"];
    for (const path of urls) {
      try {
        const response = await originalFetch(path, { cache: "no-store", credentials: "same-origin" });
        if (response.ok) await cacheResponse(path, response);
      } catch {}
    }
  }

  async function flushQueue() {
    if (syncing || !navigator.onLine) return { synced: 0, pending: await pendingCount().catch(() => 0) };
    syncing = true;
    await emitStatus("Synchronizing queued vessel records.");
    let synced = 0;
    try {
      const entries = (await getAll(QUEUE_STORE)).sort((a, b) => Number(a.id) - Number(b.id));
      for (const entry of entries) {
        const prepared = await prepareQueuedRequest(entry);
        const init = {
          method: entry.method,
          headers: entry.headers || {},
          credentials: "same-origin"
        };
        if (entry.method !== "GET" && entry.method !== "DELETE") init.body = prepared.bodyText;
        let response;
        try {
          response = await originalFetch(prepared.url, init);
        } catch {
          break;
        }
        if (!response.ok) {
          if ([401, 402, 403].includes(response.status)) lastMessage = "Queued changes require a valid signed-in subscription before they can synchronize.";
          else lastMessage = `Synchronization paused because Neptune returned HTTP ${response.status}.`;
          break;
        }
        if (entry.method === "POST" && entry.localId) {
          try {
            const payload = await response.clone().json();
            const serverId = payload?.item?.id || payload?.project?.id || payload?.id;
            if (serverId) await putRecord(MAP_STORE, { localId: entry.localId, serverId: String(serverId) });
          } catch {}
        }
        await deleteRecord(QUEUE_STORE, entry.id);
        synced += 1;
      }
      if (synced) {
        await refreshOfflineSnapshots();
        lastMessage = `${synced} queued change${synced === 1 ? "" : "s"} synchronized.`;
        window.dispatchEvent(new CustomEvent("neptune-offline-synced", { detail: { synced } }));
      }
    } finally {
      syncing = false;
      await emitStatus(lastMessage);
    }
    return { synced, pending: await pendingCount().catch(() => 0) };
  }

  async function clearPrivateData() {
    await Promise.all([clearStore(RESPONSE_STORE), clearStore(QUEUE_STORE), clearStore(MAP_STORE)]).catch(() => {});
    if (navigator.serviceWorker?.controller) navigator.serviceWorker.controller.postMessage({ type: "CLEAR_PRIVATE" });
    lastMessage = "";
    await emitStatus("");
  }

  window.fetch = async function neptuneOfflineFetch(input, init) {
    const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (url.origin !== window.location.origin) return originalFetch(request);

    if (url.pathname === "/api/auth/logout") {
      try {
        const response = await originalFetch(request);
        await clearPrivateData();
        return response;
      } catch {
        await clearPrivateData();
        return new Response(JSON.stringify({ ok: true, offline: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
    }

    if (["/api/auth/login", "/api/auth/signup"].includes(url.pathname)) {
      const response = await originalFetch(request);
      if (response.ok) await clearPrivateData();
      return response;
    }

    if (method === "GET" && shouldCacheGet(url)) {
      if (navigator.onLine) {
        try {
          const response = await originalFetch(request);
          if (response.ok) await cacheResponse(url.toString(), response);
          return response;
        } catch {}
      }
      const cached = await cachedResponse(url.toString());
      if (cached) {
        await emitStatus("Showing the last synchronized vessel records.");
        return cached;
      }
      return new Response(JSON.stringify({ error: "This information has not been downloaded to this device yet.", code: "OFFLINE_CACHE_EMPTY" }), {
        status: 503,
        headers: { "content-type": "application/json", "x-neptune-offline": "1" }
      });
    }

    if (isQueueable(url, method)) {
      if (navigator.onLine) {
        try {
          const response = await originalFetch(request);
          if (response.ok) return response;
          if (response.status < 500) return response;
        } catch {}
      }
      return queueMutation(request, url, method);
    }

    return originalFetch(request);
  };

  window.NeptuneOffline = {
    flush: flushQueue,
    clear: clearPrivateData,
    pending: pendingCount
  };

  window.addEventListener("online", () => {
    emitStatus("Connection restored. Preparing queued changes for synchronization.");
    flushQueue().then(result => {
      if (result.synced > 0 && ["/dashboard", "/admin"].some(path => window.location.pathname.startsWith(path))) {
        window.setTimeout(() => window.location.reload(), 900);
      }
    });
  });
  window.addEventListener("offline", () => emitStatus("Offline ocean mode is active."));
  window.addEventListener("neptune-offline-status-request", () => emitStatus(lastMessage));

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {}));
  }

  emitStatus(navigator.onLine ? "" : "Offline ocean mode is active.");
  if (navigator.onLine) flushQueue();
})();
