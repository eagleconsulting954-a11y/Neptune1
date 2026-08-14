"use client";

import { useEffect } from "react";

const DEVICE_KEY = "neptune_managed_device_key";
const LAST_SYNC_KEY = "neptune_last_successful_sync_at";

function deviceKey() {
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) {
    value = `device_${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_KEY, value);
  }
  return value;
}

async function gpsPermission() {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result.state;
  } catch {
    return "unknown";
  }
}

async function pendingQueue() {
  try {
    const regular = await (window as any).NeptuneOffline?.pending?.();
    const emergency = await (window as any).NeptuneEmergencyOffline?.pending?.();
    return Number(regular || 0) + Number(emergency || 0);
  } catch {
    return 0;
  }
}

async function clearNeptuneDeviceData() {
  try { await (window as any).NeptuneOffline?.clear?.(); } catch {}
  try { await (window as any).NeptuneEmergencyOffline?.clear?.(); } catch {}
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    for (const registration of registrations || []) registration.active?.postMessage?.({ type: "CLEAR_PRIVATE" });
  } catch {}
  localStorage.removeItem(DEVICE_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
}

export function ManagedDeviceBootstrap() {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function heartbeat() {
      if (stopped || !navigator.onLine) return;
      const estimate = await navigator.storage?.estimate?.().catch(() => null);
      const installed = window.matchMedia?.("(display-mode: standalone)")?.matches || Boolean((navigator as any).standalone);
      const queueDepth = await pendingQueue();
      if (queueDepth === 0) localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      const platform = (navigator as any).userAgentData?.platform || navigator.platform || "unknown";
      const label = `${platform}${installed ? " · Installed Neptune" : " · Browser"}`;

      const response = await fetch("/api/v1/security-center", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "device_heartbeat",
          device: {
            deviceKey: deviceKey(),
            label,
            platform,
            userAgent: navigator.userAgent,
            appVersion: "2026.08-enterprise",
            installed,
            offlineCapable: "serviceWorker" in navigator && "indexedDB" in window,
            gpsPermission: await gpsPermission(),
            storageBytes: estimate?.usage || 0,
            queueDepth,
            lastSyncAt: localStorage.getItem(LAST_SYNC_KEY)
          }
        })
      }).catch(() => null);

      if (!response || response.status === 401 || response.status === 402) return;
      const result = await response.json().catch(() => ({}));
      if (result.device?.revoked || result.device?.wipeRequested) {
        await clearNeptuneDeviceData();
        window.location.href = "/login?device=revoked";
      }
    }

    const statusHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.online && Number(detail.pending || 0) === 0 && !detail.syncing) {
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        void heartbeat();
      }
    };
    const onlineHandler = () => void heartbeat();

    void heartbeat();
    timer = setInterval(() => void heartbeat(), 5 * 60_000);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("neptune-offline-status", statusHandler as EventListener);
    window.addEventListener("neptune-emergency-offline-status", statusHandler as EventListener);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("neptune-offline-status", statusHandler as EventListener);
      window.removeEventListener("neptune-emergency-offline-status", statusHandler as EventListener);
    };
  }, []);

  return null;
}
