"use client";

import { useEffect } from "react";

export default function GlobalApplicationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/system/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        severity: "critical",
        route: window.location.pathname,
        method: "RENDER",
        message: error.message || "Application render failure",
        stack: error.stack || null,
        metadata: { digest: error.digest || null }
      })
    });
  }, [error]);

  return (
    <main className="auth-page">
      <section className="auth-card glass premium">
        <div className="brand"><span className="brand-mark">✦</span><span>NEPTUNE<small>System recovery</small></span></div>
        <p className="eyebrow" style={{ marginTop: 28 }}>Application issue detected</p>
        <h2>Neptune hit an unexpected problem.</h2>
        <p className="muted">The issue was reported to the platform bug portal. Retry the current screen or return to the dashboard.</p>
        <div className="actions">
          <button className="btn gold" onClick={reset}>Retry</button>
          <a className="btn" href="/dashboard">Dashboard</a>
        </div>
      </section>
    </main>
  );
}
