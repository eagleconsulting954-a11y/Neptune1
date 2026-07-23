"use client";

import { useEffect, useState } from "react";

type OfflineDetail = {
  online?: boolean;
  pending?: number;
  syncing?: boolean;
  message?: string;
};

export function OfflineStatus() {
  const [state, setState] = useState({ online: true, pending: 0, syncing: false, message: "" });

  useEffect(() => {
    setState(current => ({ ...current, online: navigator.onLine }));

    function update(event: Event) {
      const detail = (event as CustomEvent<OfflineDetail>).detail || {};
      setState(current => ({
        online: detail.online ?? current.online,
        pending: detail.pending ?? current.pending,
        syncing: detail.syncing ?? current.syncing,
        message: detail.message ?? current.message
      }));
    }

    window.addEventListener("neptune-offline-status", update);
    window.dispatchEvent(new CustomEvent("neptune-offline-status-request"));
    return () => window.removeEventListener("neptune-offline-status", update);
  }, []);

  if (state.online && !state.pending && !state.syncing && !state.message) return null;

  const label = state.syncing
    ? "Synchronizing vessel records"
    : !state.online
      ? "Offline ocean mode"
      : state.pending
        ? "Connection restored"
        : "Offline workspace";

  const detail = state.syncing
    ? `${state.pending} queued change${state.pending === 1 ? "" : "s"} being sent to Neptune.`
    : !state.online
      ? `${state.pending ? `${state.pending} change${state.pending === 1 ? " is" : "s are"} safely queued. ` : ""}Last-synced records remain available on this device.`
      : state.pending
        ? `${state.pending} queued change${state.pending === 1 ? "" : "s"} will synchronize automatically.`
        : state.message;

  return <aside className={`offline-status ${state.online ? "online" : "offline"} ${state.syncing ? "syncing" : ""}`} role="status" aria-live="polite">
    <span className="offline-status-dot" />
    <div><b>{label}</b><small>{detail}</small></div>
  </aside>;
}
