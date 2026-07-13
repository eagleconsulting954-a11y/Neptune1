"use client";

import { useEffect, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState("captain");

  useEffect(() => {
    if (mode !== "signup") return;
    const requested = new URLSearchParams(window.location.search).get("plan") || "captain";
    const normalized = requested.toLowerCase().replaceAll("-", "_");
    if (["captain", "fleetops", "full_vessel_access"].includes(normalized)) setPlan(normalized);
  }, [mode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, FormDataEntryValue | string> = Object.fromEntries(form.entries());
    if (mode === "login") payload.from = new URLSearchParams(window.location.search).get("from") || "/dashboard";
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Unable to continue");
      setLoading(false);
      return;
    }
    window.location.href = data.redirect || (mode === "signup" ? "/dashboard" : "/dashboard");
  }

  return (
    <form className="form" onSubmit={submit}>
      {mode === "signup" && <>
        <label>Trial package<select name="plan" value={plan} onChange={event => setPlan(event.target.value)}><option value="captain">Captain · $499/month after trial</option><option value="fleetops">FleetOps · $1,499/month after trial</option><option value="full_vessel_access">Full Vessel Access · $1,998/month after trial</option></select></label>
        <label>Organization<input name="organization" required placeholder="Your company or fleet organization" /></label>
        <label>Your name<input name="name" required placeholder="Captain, fleet manager, or administrator" /></label>
      </>}
      <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@company.com" /></label>
      <label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Minimum 8 characters" /></label>
      <button className="btn gold" disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Enter Neptune" : "Start 14-day trial"}</button>
      {mode === "signup" && <p className="muted" style={{ margin: 0, fontSize: 11 }}>Your trial follows the package selected above. Full-suite access is available only with Full Vessel Access or Enterprise.</p>}
      {message && <div className="form-message error">{message}</div>}
    </form>
  );
}
