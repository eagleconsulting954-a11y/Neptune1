"use client";

import Link from "next/link";
import { useState } from "react";

export function CheckoutButton({ plan, label }: { plan: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function checkout() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan })
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else {
      setMessage(data.error || "Unable to start checkout");
      setLoading(false);
    }
  }

  return (
    <div className="form">
      <button className="btn gold" onClick={checkout} disabled={loading}>{loading ? "Preparing checkout..." : label}</button>
      <Link className="btn" href="/demo">Open public demo</Link>
      {message && <div className="form-message error">{message}</div>}
    </div>
  );
}
