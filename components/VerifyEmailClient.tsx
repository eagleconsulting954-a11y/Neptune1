"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function VerifyEmailClient({ token, email, sent, delivery }: { token?: string; email?: string; sent?: boolean; delivery?: string }) {
  const [address, setAddress] = useState(email || "");
  const [status, setStatus] = useState(token ? "Verifying your secure link..." : sent ? "Check your inbox for the Neptune verification link." : "Verify your email before signing in.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      const result = await response.json().catch(() => ({}));
      if (!active) return;
      setLoading(false);
      if (!response.ok) {
        setError(result.error || "Unable to verify this email.");
        setStatus("");
        return;
      }
      setVerified(true);
      setStatus("Email verified. Your Neptune identity is ready.");
    })();
    return () => { active = false; };
  }, [token]);

  async function resend(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: address })
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error || "Unable to resend the verification email.");
      return;
    }
    setStatus(result.message || "A new verification link has been sent.");
  }

  return <div className="form" style={{ marginTop: 22 }}>
    {delivery === "retry" && <div className="form-message error">The account was created, but the first verification email could not be delivered. Use the resend control below after your verified sending domain is available.</div>}
    {status && <div className={`form-message ${verified ? "success" : ""}`}>{status}</div>}
    {error && <div className="form-message error">{error}</div>}
    {verified ? <Link className="btn gold" href="/login?verified=success">Continue to secure login</Link> : <form className="form" onSubmit={resend}>
      <label>Email<input type="email" required value={address} onChange={event => setAddress(event.target.value)} placeholder="you@company.com" /></label>
      <button className="btn" disabled={loading}>{loading ? "Please wait..." : "Resend verification email"}</button>
    </form>}
    <p className="muted" style={{ margin: 0 }}>Verification links expire after 24 hours and can be used once.</p>
  </div>;
}
