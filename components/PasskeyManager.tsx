"use client";

import Link from "next/link";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";

function when(value: unknown) {
  if (!value) return "Never";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/v1/security-center", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login?from=/passkeys";
      return;
    }
    if (response.status === 402) {
      window.location.href = "/trial-expired?from=/passkeys";
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Unable to load passkeys.");
      setLoading(false);
      return;
    }
    setPasskeys(result.passkeys || []);
    setLoading(false);
  }

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    void load();
  }, []);

  async function enroll() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const optionsResponse = await fetch("/api/v1/security-center", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "passkey_options" })
      });
      const optionsResult = await optionsResponse.json().catch(() => ({}));
      if (!optionsResponse.ok) throw new Error(optionsResult.error || "Unable to begin passkey enrollment.");

      const response = await startRegistration({ optionsJSON: optionsResult.options });
      const label = `${navigator.platform || "Device"} passkey`;
      const verifyResponse = await fetch("/api/v1/security-center", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "passkey_register", response, label })
      });
      const result = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok) throw new Error(result.error || "Passkey registration failed.");
      setMessage("Passkey registered. You can now use this phishing-resistant sign-in method from the Neptune login page.");
      await load();
    } catch (err) {
      const value = err instanceof Error ? err.message : "Passkey enrollment was canceled or failed.";
      setError(value);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this passkey from your Neptune account?")) return;
    const response = await fetch("/api/v1/security-center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "passkey_remove", passkeyId: id })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Unable to remove passkey.");
      return;
    }
    setMessage("Passkey removed.");
    await load();
  }

  return <main className="section" style={{ minHeight: "100vh", paddingTop: 30 }}>
    <div className="container" style={{ maxWidth: 900, display: "grid", gap: 18 }}>
      <div className="workspace-header"><div><p className="eyebrow">Phishing-resistant identity</p><h1>Neptune Passkeys</h1><p className="muted">Use Face ID, Touch ID, Windows Hello, Android device unlock, or a compatible security key without sending a reusable password to Neptune.</p></div><div className="actions"><Link className="btn" href="/security-center">Security Center</Link><Link className="btn" href="/dashboard">Command</Link></div></div>
      {message && <div className="form-message success">{message}</div>}
      {error && <div className="form-message error">{error}</div>}
      <article className="record">
        <p className="eyebrow">WebAuthn</p><h3>{supported ? "This browser supports passkeys" : "Passkeys are not available in this browser"}</h3>
        <p>Neptune requires user verification during passkey registration and sign-in. Registered credentials are stored as public keys; the private key stays with your authenticator.</p>
        <button className="btn gold" disabled={!supported || busy} onClick={enroll}>{busy ? "Waiting for authenticator..." : "Add a passkey"}</button>
      </article>
      <article className="record"><p className="eyebrow">Registered passkeys</p>{loading ? <p>Loading...</p> : passkeys.length ? <div className="data-grid"><table><thead><tr><th>Label</th><th>Type</th><th>Backup</th><th>Last used</th><th>Created</th><th>Action</th></tr></thead><tbody>{passkeys.map(item => <tr key={item.id}><td>{item.label || "Passkey"}</td><td>{item.device_type || "Authenticator"}</td><td>{item.backed_up ? "Backed up" : "Device bound/unknown"}</td><td>{when(item.last_used_at)}</td><td>{when(item.created_at)}</td><td><button className="btn danger" onClick={() => remove(item.id)}>Remove</button></td></tr>)}</tbody></table></div> : <p className="muted">No passkeys registered yet. Authenticator MFA remains available independently.</p>}</article>
    </div>
  </main>;
}
