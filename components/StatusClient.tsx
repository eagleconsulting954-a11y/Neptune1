"use client";

import { useEffect, useState } from "react";

export function StatusClient() {
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      setState(result);
      if (!response.ok && !result.status) setError("Unable to retrieve the service health snapshot.");
    } catch {
      setError("Unable to reach the Neptune health endpoint.");
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(timer);
  }, []);

  const operational = state?.status === "operational";
  return <div style={{ display: "grid", gap: 18 }}>
    <article className="record">
      <p className="eyebrow">Current platform snapshot</p>
      <h2>{operational ? "Operational" : state ? "Degraded" : "Checking..."}</h2>
      <p className="muted">This page reports the current application/database health check. It is not a historical uptime SLA report.</p>
      {error && <div className="form-message error">{error}</div>}
      {state && <div className="record-grid" style={{ marginTop: 16 }}>
        <article className="record"><span className="muted">Application</span><h3>{state.services?.application ? "Available" : "Unavailable"}</h3></article>
        <article className="record"><span className="muted">Database</span><h3>{state.services?.database ? "Connected" : "Degraded"}</h3></article>
        <article className="record"><span className="muted">DB latency</span><h3>{state.metrics?.databaseLatencyMs == null ? "—" : `${state.metrics.databaseLatencyMs} ms`}</h3></article>
        <article className="record"><span className="muted">Release</span><h3>{state.release || "—"}</h3></article>
      </div>}
    </article>
    <article className="record"><p className="eyebrow">Operational boundary</p><h3>External maritime feeds are separate dependencies.</h3><p>Weather, ocean, congestion, bunker pricing, email delivery, and payment providers can experience independent degradation even when the Neptune application/database health check is operational. Official bridge and maritime safety systems remain primary.</p></article>
    <button className="btn" onClick={refresh}>Refresh status</button>
  </div>;
}
