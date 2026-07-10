"use client";

import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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
    window.location.href = data.redirect || (mode === "signup" ? "/checkout" : "/dashboard");
  }

  return (
    <form className="form" onSubmit={submit}>
      {mode === "signup" && <><label>Organization<input name="organization" required placeholder="Atlantic Fleet Group" /></label><label>Your name<input name="name" required placeholder="Captain or fleet manager" /></label></>}
      <label>Email<input name="email" type="email" required defaultValue={mode === "login" ? "admin@neptune.local" : ""} /></label>
      <label>Password<input name="password" type="password" required minLength={8} defaultValue={mode === "login" ? "neptune-admin" : ""} /></label>
      <button className="btn gold" disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Enter Neptune" : "Create workspace"}</button>
      {message && <div className="form-message error">{message}</div>}
    </form>
  );
}
