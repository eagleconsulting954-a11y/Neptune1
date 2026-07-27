(() => {
  if (typeof window === "undefined" || window.__NEPTUNE_EMERGENCY_OFFLINE__) return;
  window.__NEPTUNE_EMERGENCY_OFFLINE__ = true;

  const DB_NAME = "neptune-emergency-gps-v1";
  const DB_VERSION = 1;
  const STATE = "state";
  const POSITIONS = "positions";
  const QUEUE = "queue";
  const underlyingFetch = window.fetch.bind(window);
  let syncing = false;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STATE)) database.createObjectStore(STATE, { keyPath: "key" });
        if (!database.objectStoreNames.contains(POSITIONS)) {
          const store = database.createObjectStore(POSITIONS, { keyPath: "id" });
          store.createIndex("event_id", "event_id", { unique: false });
          store.createIndex("sync_state", "sync_state", { unique: false });
        }
        if (!database.objectStoreNames.contains(QUEUE)) database.createObjectStore(QUEUE, { keyPath: "id", autoIncrement: true });
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
  const clearStore = store => storeRequest(store, "readwrite", objectStore => objectStore.clear());

  async function activeEvent() {
    return (await get(STATE, "active_event").catch(() => null))?.value || null;
  }

  async function setActiveEvent(value) {
    if (!value) return remove(STATE, "active_event").catch(() => {});
    return put(STATE, { key: "active_event", value, updatedAt: Date.now() });
  }

  async function positionRows(eventId) {
    const rows = await all(POSITIONS).catch(() => []);
    return rows
      .filter(row => !eventId || row.event_id === eventId)
      .sort((a, b) => Number(a.sequence_no) - Number(b.sequence_no));
  }

  async function pendingCount() {
    const [positions, queue] = await Promise.all([all(POSITIONS).catch(() => []), all(QUEUE).catch(() => [])]);
    const unsyncedPositions = positions.filter(row => row.sync_state !== "synced").length;
    const nonPositionWrites = queue.filter(entry => !entry.positionIds?.length).length;
    return unsyncedPositions + nonPositionWrites;
  }

  async function emit(message = "") {
    window.dispatchEvent(new CustomEvent("neptune-emergency-offline-status", {
      detail: {
        online: navigator.onLine,
        syncing,
        pending: await pendingCount(),
        message
      }
    }));
  }

  async function markPositions(ids, syncState) {
    for (const id of ids || []) {
      const row = await get(POSITIONS, id).catch(() => null);
      if (row) await put(POSITIONS, { ...row, sync_state: syncState, sync_updated_at: Date.now() });
    }
  }

  async function networkRequest(url, method, body) {
    return underlyingFetch(url, {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async function queueRequest(url, method, body, positionIds = []) {
    await add(QUEUE, { url, method, body, positionIds, createdAt: Date.now() });
    if (positionIds.length) await markPositions(positionIds, "queued");
    await emit("Emergency GPS data is stored on this device and has not been transmitted.");
    return { ok: true, queued: true, status: 202 };
  }

  async function sendOrQueue(url, method, body, positionIds = []) {
    if (navigator.onLine) {
      try {
        const response = await networkRequest(url, method, body);
        if (response.ok) {
          if (positionIds.length) await markPositions(positionIds, "synced");
          await emit(positionIds.length ? "Emergency GPS positions synchronized." : "Emergency event synchronized.");
          return { ok: true, queued: false, status: response.status, response };
        }
        if (response.status < 500) return { ok: false, queued: false, status: response.status, response };
      } catch {}
    }
    return queueRequest(url, method, body, positionIds);
  }

  async function startEvent(event) {
    await setActiveEvent(event);
    const result = await sendOrQueue("/api/v1/emergency-events", "POST", event);
    await emit(result.queued ? "Emergency event created locally. Position data has not been transmitted." : "Emergency event opened and connected.");
    return result;
  }

  async function updateEvent(event) {
    const current = await activeEvent();
    if (current?.id === event.id) {
      if (["Stopped", "Closed", "Resolved"].includes(event.status)) await setActiveEvent(null);
      else await setActiveEvent({ ...current, ...event });
    }
    return sendOrQueue("/api/v1/emergency-events", "PATCH", event);
  }

  async function appendPosition(position) {
    await put(POSITIONS, { ...position, sync_state: "pending", stored_at: Date.now() });
    const pending = (await positionRows(position.event_id)).filter(row => row.sync_state === "pending");
    if (pending.length >= 5) await flushPending(position.event_id);
    await emit(navigator.onLine ? "Emergency GPS position stored." : "Emergency GPS position stored locally — not transmitted.");
    return { ok: true, pending: await pendingCount() };
  }

  async function flushPending(eventId) {
    const rows = (await positionRows(eventId)).filter(row => row.sync_state === "pending");
    let processed = 0;
    for (let index = 0; index < rows.length; index += 100) {
      const chunk = rows.slice(index, index + 100);
      const positionIds = chunk.map(row => row.id);
      const positions = chunk.map(({ sync_state, stored_at, sync_updated_at, event_id, ...position }) => position);
      const result = await sendOrQueue("/api/v1/emergency-positions/batch", "POST", { event_id: eventId, positions }, positionIds);
      if (!result.ok) break;
      processed += chunk.length;
    }
    return { processed, pending: await pendingCount() };
  }

  async function flushQueue() {
    if (syncing || !navigator.onLine) return { synced: 0, pending: await pendingCount() };
    syncing = true;
    await emit("Synchronizing emergency GPS records.");
    let synced = 0;
    try {
      const entries = (await all(QUEUE).catch(() => [])).sort((a, b) => Number(a.id) - Number(b.id));
      for (const entry of entries) {
        let response;
        try { response = await networkRequest(entry.url, entry.method, entry.body); } catch { break; }
        if (!response.ok) {
          if ([401, 402, 403].includes(response.status)) await emit("Emergency GPS synchronization requires a valid signed-in subscription.");
          else await emit(`Emergency GPS synchronization paused at HTTP ${response.status}.`);
          break;
        }
        if (entry.positionIds?.length) await markPositions(entry.positionIds, "synced");
        await remove(QUEUE, entry.id);
        synced += 1;
      }
      const event = await activeEvent();
      if (event?.id) await flushPending(event.id);
    } finally {
      syncing = false;
      await emit(synced ? `${synced} emergency GPS package${synced === 1 ? "" : "s"} synchronized.` : "");
    }
    return { synced, pending: await pendingCount() };
  }

  async function load() {
    const event = await activeEvent();
    return {
      activeEvent: event,
      positions: event?.id ? await positionRows(event.id) : [],
      pending: await pendingCount()
    };
  }

  async function clear() {
    await Promise.all([clearStore(STATE), clearStore(POSITIONS), clearStore(QUEUE)]).catch(() => {});
    await emit("");
  }

  const wrappedFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === window.location.origin && ["/api/auth/login", "/api/auth/signup"].includes(url.pathname)) await clear();
    try {
      const response = await wrappedFetch(request);
      if (url.origin === window.location.origin && url.pathname === "/api/auth/logout") await clear();
      return response;
    } catch (error) {
      if (url.origin === window.location.origin && url.pathname === "/api/auth/logout") await clear();
      throw error;
    }
  };

  window.NeptuneEmergencyOffline = {
    startEvent,
    updateEvent,
    appendPosition,
    flushPending,
    flush: flushQueue,
    load,
    pending: pendingCount,
    clear
  };

  window.addEventListener("online", () => flushQueue());
  window.addEventListener("neptune-emergency-status-request", () => emit(""));
  window.dispatchEvent(new CustomEvent("neptune-emergency-offline-ready"));
  if (navigator.onLine) flushQueue();
})();
