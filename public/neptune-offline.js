(() => {
  if (typeof window === "undefined" || window.__NEPTUNE_OFFLINE_V2__) return;
  window.__NEPTUNE_OFFLINE_V2__ = true;

  const DB_NAME = "neptune-offline-v2";
  const DB_VERSION = 1;
  const RESPONSES = "responses";
  const QUEUE = "queue";
  const ID_MAP = "id_map";
  const nativeFetch = window.fetch.bind(window);
  let syncing = false;
  let statusMessage = "";

  const queueable = [
    /^\/api\/v1\/(vessels|duties|work_orders|certificates|incidents|crm_accounts|activity_events|ports|bunker_plans|mrcc_contacts|port_congestion_snapshots)$/,
    /^\/api\/v1\/(ev-projects|future-ev\/projects)$/,
    /^\/api\/v1\/settings\/duty-options$/,
    /^\/api\/v1\/intelligence\/(bunker-plan|mrcc)$/
  ];

  const dashboardFields = {
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

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(RESPONSES)) database.createObjectStore(RESPONSES, { keyPath: "url" });
        if (!database.objectStoreNames.contains(QUEUE)) database.createObjectStore(QUEUE, { keyPath: "id", autoIncrement: true });
        if (!database.objectStoreNames.contains(ID_MAP)) database.createObjectStore(ID_MAP, { keyPath: "localId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function storeRequest(storeName, mode, action) {
    const database = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      let result;
      if (request) {
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error);
      }
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
  }

  const get = (store, key) => storeRequest(store, "readonly", objectStore => objectStore.get(key));
  const all = store => storeRequest(store, "readonly", objectStore => objectStore.getAll());
  const put = (store, value) => storeRequest(store, "readwrite", objectStore => objectStore.put(value));
  const add = (store, value) => storeRequest(store, "readwrite", objectStore => objectStore.add(value));
  const remove = (store, key) => storeRequest(store, "readwrite", objectStore => objectStore.delete(key));
  const clear = store => storeRequest(store, "readwrite", objectStore => objectStore.clear());

  function cacheKey(value) {
    return new URL(value, window.location.origin).toString();
  }

  async function pendingCount() {
    try { return (await all(QUEUE)).length; } catch { return 0; }
  }

  async function emit(message = statusMessage) {
    statusMessage = message || "";
    window.dispatchEvent(new CustomEvent("neptune-offline-status", {
      detail: {
        online: navigator.onLine,
        pending: await pendingCount(),
        syncing,
        message: statusMessage
      }
    }));
  }

  async function saveResponse(url, response) {
    if (!response.ok || [401, 402, 403].includes(response.status)) return;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json") && !contentType.includes("text")) return;
    await put(RESPONSES, {
      url: cacheKey(url),
      status: response.status,
      statusText: response.statusText,
      contentType,
      body: await response.clone().text(),
      updatedAt: Date.now()
    });
  }

  async function cachedResponse(url) {
    const record = await get(RESPONSES, cacheKey(url)).catch(() => null);
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

  async function readJson(url) {
    const record = await get(RESPONSES, cacheKey(url)).catch(() => null);
    if (!record?.body) return null;
    try { return JSON.parse(record.body); } catch { return null; }
  }

  async function writeJson(url, value) {
    await put(RESPONSES, {
      url: cacheKey(url),
      status: 200,
      statusText: "OK",
      contentType: "application/json",
      body: JSON.stringify(value),
      updatedAt: Date.now()
    });
  }

  function openStatus(value) {
    return !["closed", "complete", "completed", "resolved", "cancelled", "canceled"].includes(String(value || "").toLowerCase());
  }

  function recalculate(data) {
    const vessels = data.vessels || [];
    const duties = data.duties || [];
    const workOrders = data.workOrders || [];
    const certificates = data.certificates || [];
    const incidents = data.incidents || [];
    const crm = data.crm || [];
    const ports = data.ports || [];
    const mrcc = data.mrccContacts || [];
    const readiness = vessels.length ? Math.round(vessels.reduce((sum, item) => sum + Number(item.readiness || 0), 0) / vessels.length) : 0;
    const expiring = certificates.filter(item => {
      const explicit = String(item.status || "").toLowerCase().includes("expir");
      const time = item.expires_at ? new Date(item.expires_at).getTime() : NaN;
      const days = Number.isFinite(time) ? Math.ceil((time - Date.now()) / 86400000) : null;
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
      expiringCertificates: expiring,
      openIncidents: incidents.filter(item => openStatus(item.status)).length,
      critical: criticalDuties + criticalIncidents,
      pipeline: crm.reduce((sum, item) => sum + Number(item.annual_value || 0), 0),
      ports: ports.length,
      verifiedMrcc: mrcc.filter(item => Boolean(item.verified_at)).length
    };
    return data;
  }

  function localRecord(body, localId) {
    return { ...body, id: localId, created_at: body.created_at || new Date().toISOString(), offline_pending: true };
  }

  function mutateRows(rows, method, body, localId, deleteId) {
    const current = Array.isArray(rows) ? rows : [];
    const target = body.id || deleteId;
    if (method === "POST") return [localRecord(body, localId), ...current];
    if (["PATCH", "PUT"].includes(method)) return current.map(item => String(item.id) === String(target) ? { ...item, ...body, offline_pending: true } : item);
    if (method === "DELETE") return current.filter(item => String(item.id) !== String(target));
    return current;
  }

  async function optimistic(url, method, body, localId) {
    const deleteId = url.searchParams.get("id");

    if (url.pathname === "/api/v1/settings/duty-options") {
      const old = await readJson(url.pathname) || {};
      await writeJson(url.pathname, {
        ...old,
        ...body,
        owners: body.owners || old.owners || [],
        locations: body.locations || old.locations || [],
        configuredOwners: body.owners || old.configuredOwners || [],
        configuredLocations: body.locations || old.configuredLocations || [],
        isConfigured: true,
        updatedAt: new Date().toISOString(),
        offline_pending: true
      });
      return;
    }

    if (["/api/v1/ev-projects", "/api/v1/future-ev/projects"].includes(url.pathname)) {
      const payload = await readJson(url.pathname) || { projects: [] };
      payload.projects = mutateRows(payload.projects, method, body, localId, deleteId);
      await writeJson(url.pathname, payload);
      return;
    }

    const resource = url.pathname.split("/").filter(Boolean).pop();
    const endpointPayload = await readJson(url.pathname);
    if (endpointPayload?.items) {
      endpointPayload.items = mutateRows(endpointPayload.items, method, body, localId, deleteId);
      await writeJson(url.pathname, endpointPayload);
    }

    const field = dashboardFields[resource];
    if (field) {
      const dashboard = await readJson("/api/v1/dashboard");
      if (dashboard) {
        dashboard[field] = mutateRows(dashboard[field], method, body, localId, deleteId);
        await writeJson("/api/v1/dashboard", recalculate(dashboard));
      }
    }

    if (resource === "crm_accounts") {
      const admin = await readJson("/api/v1/admin/analytics");
      if (admin) {
        admin.crm = mutateRows(admin.crm, method, body, localId, deleteId);
        const pipeline = admin.crm.reduce((sum, item) => sum + Number(item.annual_value || 0), 0);
        admin.summary = { ...(admin.summary || {}), accounts: admin.crm.length, pipeline };
        await writeJson("/api/v1/admin/analytics", admin);
      }
    }
  }

  async function queueRequest(request, url, method) {
    const bodyText = method === "DELETE" ? "" : await request.clone().text();
    let body = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch {}
    const localId = method === "POST" ? `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : body.id || url.searchParams.get("id") || null;
    const headers = {};
    request.headers.forEach((value, key) => {
      if (!["content-length", "host", "connection"].includes(key.toLowerCase())) headers[key] = value;
    });
    await add(QUEUE, { url: url.pathname + url.search, method, headers, bodyText, localId, createdAt: Date.now() });
    await optimistic(url, method, body, localId);
    await emit("Changes are stored on this device until connectivity returns.");
    const record = localRecord(body, localId);
    return new Response(JSON.stringify(method === "DELETE" ? { ok: true, offlineQueued: true } : { ok: true, offlineQueued: true, item: record, project: record }), {
      status: 202,
      statusText: "Accepted Offline",
      headers: { "content-type": "application/json", "x-neptune-offline-queued": "1" }
    });
  }

  async function resolveId(localId) {
    if (!localId || !String(localId).startsWith("offline_")) return localId;
    const mapped = await get(ID_MAP, localId).catch(() => null);
    return mapped?.serverId || localId;
  }

  async function preparedEntry(entry) {
    const url = new URL(entry.url, window.location.origin);
    let bodyText = entry.bodyText || "";
    if (bodyText) {
      try {
        const body = JSON.parse(bodyText);
        if (body.id) body.id = await resolveId(body.id);
        delete body.offline_pending;
        if (entry.method === "POST") delete body.id;
        bodyText = JSON.stringify(body);
      } catch {}
    }
    if (entry.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (id) url.searchParams.set("id", await resolveId(id));
    }
    return { url: url.toString(), bodyText };
  }

  async function refreshSnapshots() {
    for (const path of ["/api/v1/dashboard", "/api/v1/settings/duty-options", "/api/v1/ev-projects", "/api/v1/admin/analytics"]) {
      try {
        const response = await nativeFetch(path, { cache: "no-store", credentials: "same-origin" });
        if (response.ok) await saveResponse(path, response);
      } catch {}
    }
  }

  async function flushQueue() {
    if (syncing || !navigator.onLine) return { synced: 0, pending: await pendingCount() };
    syncing = true;
    await emit("Synchronizing queued vessel records.");
    let synced = 0;
    try {
      const entries = (await all(QUEUE)).sort((a, b) => Number(a.id) - Number(b.id));
      for (const entry of entries) {
        const prepared = await preparedEntry(entry);
        const init = { method: entry.method, headers: entry.headers || {}, credentials: "same-origin" };
        if (!['GET', 'DELETE'].includes(entry.method)) init.body = prepared.bodyText;
        let response;
        try { response = await nativeFetch(prepared.url, init); } catch { break; }
        if (!response.ok) {
          statusMessage = [401, 402, 403].includes(response.status)
            ? "Queued changes need a valid signed-in subscription before synchronization."
            : `Synchronization paused because Neptune returned HTTP ${response.status}.`;
          break;
        }
        if (entry.method === "POST" && entry.localId) {
          try {
            const payload = await response.clone().json();
            const serverId = payload?.item?.id || payload?.project?.id || payload?.id;
            if (serverId) await put(ID_MAP, { localId: entry.localId, serverId: String(serverId) });
          } catch {}
        }
        await remove(QUEUE, entry.id);
        synced += 1;
      }
      if (synced) {
        await refreshSnapshots();
        statusMessage = `${synced} queued change${synced === 1 ? "" : "s"} synchronized.`;
        window.dispatchEvent(new CustomEvent("neptune-offline-synced", { detail: { synced } }));
      }
    } finally {
      syncing = false;
      await emit(statusMessage);
    }
    return { synced, pending: await pendingCount() };
  }

  async function clearPrivateData() {
    await Promise.all([clear(RESPONSES), clear(QUEUE), clear(ID_MAP)]).catch(() => {});
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE" });
    statusMessage = "";
    await emit("");
  }

  function isQueueable(url, method) {
    return ["POST", "PATCH", "PUT", "DELETE"].includes(method) && queueable.some(pattern => pattern.test(url.pathname));
  }

  window.fetch = async (input, init) => {
    const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (url.origin !== window.location.origin) return nativeFetch(request);

    if (url.pathname === "/api/auth/logout") {
      try {
        const response = await nativeFetch(request.clone());
        await clearPrivateData();
        return response;
      } catch {
        await clearPrivateData();
        return new Response(JSON.stringify({ ok: true, offline: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
    }

    if (["/api/auth/login", "/api/auth/signup"].includes(url.pathname)) {
      const response = await nativeFetch(request.clone());
      if (response.ok) await clearPrivateData();
      return response;
    }

    if (method === "GET" && url.pathname.startsWith("/api/v1/")) {
      let networkResponse = null;
      if (navigator.onLine) {
        try {
          networkResponse = await nativeFetch(request.clone());
          if (networkResponse.ok) {
            await saveResponse(url.toString(), networkResponse);
            return networkResponse;
          }
          if (networkResponse.status < 500) return networkResponse;
        } catch {}
      }
      const offline = await cachedResponse(url.toString());
      if (offline) {
        await emit("Showing the last synchronized vessel records.");
        return offline;
      }
      if (networkResponse) return networkResponse;
      return new Response(JSON.stringify({ error: "This information has not been downloaded to this device yet.", code: "OFFLINE_CACHE_EMPTY" }), {
        status: 503,
        headers: { "content-type": "application/json", "x-neptune-offline": "1" }
      });
    }

    if (isQueueable(url, method)) {
      const offlineCopy = request.clone();
      if (navigator.onLine) {
        try {
          const response = await nativeFetch(request.clone());
          if (response.ok || response.status < 500) return response;
        } catch {}
      }
      return queueRequest(offlineCopy, url, method);
    }

    return nativeFetch(request);
  };

  window.NeptuneOffline = { flush: flushQueue, clear: clearPrivateData, pending: pendingCount };
  window.addEventListener("online", () => {
    emit("Connection restored. Preparing queued changes for synchronization.");
    flushQueue().then(result => {
      if (result.synced && ["/dashboard", "/admin"].some(path => window.location.pathname.startsWith(path))) {
        window.setTimeout(() => window.location.reload(), 900);
      }
    });
  });
  window.addEventListener("offline", () => emit("Offline ocean mode is active."));
  window.addEventListener("neptune-offline-status-request", () => emit(statusMessage));

  async function registerWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller || registration.active || registration.waiting;
      worker?.postMessage({ type: "CACHE_PAGE", url: window.location.pathname + window.location.search });
    } catch {}
  }

  window.addEventListener("load", registerWorker);
  navigator.serviceWorker?.addEventListener("controllerchange", registerWorker);
  emit(navigator.onLine ? "" : "Offline ocean mode is active.");
  if (navigator.onLine) flushQueue();
})();
