"use client";

import { useState } from "react";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email") })
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(result.error || "Unable to request a password reset.");
      return;
    }

    setSuccess(true);
    setMessage(result.message || "Check your inbox for a secure reset link.");
    event.currentTarget.reset();
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@company.com" /></label>
      <button className="btn gold" disabled={loading}>{loading ? "Sending secure link..." : "Email reset link"}</button>
      {message && <div className={`form-message ${success ? "success" : "error"}`}>{message}</div>}
    </form>
  );
}
