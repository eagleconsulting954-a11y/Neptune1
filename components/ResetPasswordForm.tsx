"use client";

import Link from "next/link";
import { useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        password: form.get("password"),
        confirmPassword: form.get("confirmPassword")
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Unable to update the password.");
      setLoading(false);
      return;
    }
    window.location.href = result.redirect || "/login?reset=success";
  }

  if (!token) {
    return (
      <div className="password-reset-missing">
        <div className="form-message error">This reset link is incomplete.</div>
        <Link className="btn gold" href="/forgot-password">Request another reset link</Link>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>New password<input name="password" type="password" required minLength={10} autoComplete="new-password" placeholder="At least 10 characters" /></label>
      <label>Confirm new password<input name="confirmPassword" type="password" required minLength={10} autoComplete="new-password" placeholder="Enter the same password again" /></label>
      <p className="password-requirements">Use uppercase, lowercase, a number, and at least 10 characters.</p>
      <button className="btn gold" disabled={loading}>{loading ? "Updating password..." : "Update password"}</button>
      {message && <div className="form-message error">{message}</div>}
    </form>
  );
}
