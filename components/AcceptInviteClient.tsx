"use client";

import { useState } from "react";

export function AcceptInviteClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, name: form.get("name"), password: form.get("password") })
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(result.error || "Unable to accept this invitation.");
      return;
    }
    window.location.href = result.redirect || "/login";
  }

  if (!token) return <div className="form-message error">The invitation token is missing.</div>;

  return <form className="form" onSubmit={submit}>
    <label>Your name<input name="name" required autoComplete="name" placeholder="Full name" /></label>
    <label>Create password<input name="password" type="password" required minLength={12} autoComplete="new-password" placeholder="Minimum 12 characters" /></label>
    <button className="btn gold" disabled={loading}>{loading ? "Creating secure account..." : "Accept invitation"}</button>
    {message && <div className="form-message error">{message}</div>}
  </form>;
}
