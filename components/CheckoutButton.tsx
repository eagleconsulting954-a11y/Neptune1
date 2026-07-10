"use client";

import { useState } from "react";

export function CheckoutButton({ plan, label }: { plan: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function checkout() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else { setMessage(data.error || "Unable to start checkout"); setLoading(false); }
  }

  async function demoUnlock() {
    setLoading(true);
    await fetch("/api/billing/demo", { method: "POST" });
    window.location.href = "/dashboard";
  }

  return <div className="form"><button className="btn gold" onClick={checkout} disabled={loading}>{loading ? "Preparing checkout..." : label}</button><button className="btn" onClick={demoUnlock} disabled={loading}>Preview with demo access</button>{message && <div className="form-message error">{message}</div>}</div>;
}
