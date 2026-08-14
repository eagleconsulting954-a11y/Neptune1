"use client";

import Link from "next/link";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [message, setMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [plan, setPlan] = useState("captain");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setPasskeySupported(browserSupportsWebAuthn());
    if (mode !== "signup") return;
    const requested = new URLSearchParams(window.location.search).get("plan") || "captain";
    const normalized = requested.toLowerCase().replaceAll("-", "_");
    if (["captain", "fleetops", "full_vessel_access"].includes(normalized)) setPlan(normalized);
  }, [mode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setVerificationEmail("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, FormDataEntryValue | string> = Object.fromEntries(form.entries());
    if (mode === "login") {
      payload.from = new URLSearchParams(window.location.search).get("from") || "/dashboard";
      payload.deviceLabel = typeof navigator !== "undefined" ? navigator.platform || "Neptune device" : "Neptune device";
    }
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === "MFA_REQUIRED" || data.mfaRequired) setMfaRequired(true);
      if (data.code === "EMAIL_VERIFICATION_REQUIRED" && data.email) setVerificationEmail(String(data.email));
      setMessage(data.error || "Unable to continue");
      setLoading(false);
      return;
    }
    window.location.href = data.redirect || "/dashboard";
  }

  async function passkeyLogin() {
    if (!email.trim()) {
      setMessage("Enter your verified Neptune email first, then choose passkey sign-in.");
      return;
    }
    setPasskeyLoading(true);
    setMessage("");
    try {
      const optionsResponse = await fetch("/api/auth/passkey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "options", email })
      });
      const optionsResult = await optionsResponse.json().catch(() => ({}));
      if (!optionsResponse.ok) throw new Error(optionsResult.error || "No passkey is available for this account.");
      const response = await startAuthentication({ optionsJSON: optionsResult.options });
      const verifyResponse = await fetch("/api/auth/passkey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email,
          response,
          from: new URLSearchParams(window.location.search).get("from") || "/dashboard",
          deviceLabel: `${navigator.platform || "Neptune device"} · Passkey`
        })
      });
      const result = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok) throw new Error(result.error || "Passkey verification failed.");
      window.location.href = result.redirect || "/dashboard";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey sign-in was canceled or failed.");
      setPasskeyLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      {mode === "signup" && <>
        <label>Trial package<select name="plan" value={plan} onChange={event => setPlan(event.target.value)}><option value="captain">Captain · $499/month after trial</option><option value="fleetops">FleetOps · $1,499/month after trial</option><option value="full_vessel_access">Full Vessel Access · $1,998/month after trial</option></select></label>
        <label>Organization<input name="organization" required placeholder="Your company or fleet organization" /></label>
        <label>Your name<input name="name" required placeholder="Captain, fleet manager, or administrator" /></label>
      </>}
      <label>Email<input name="email" type="email" required autoComplete={mode === "login" ? "username webauthn" : "email"} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" /></label>
      <label>Password<input name="password" type="password" required minLength={mode === "signup" ? 12 : 8} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "signup" ? "Minimum 12 characters" : "Your password"} /></label>
      {mode === "login" && mfaRequired && <label>Authenticator or recovery code<input name="mfaCode" required autoComplete="one-time-code" inputMode="numeric" placeholder="6-digit code or recovery code" /></label>}
      <button className="btn gold" disabled={loading || passkeyLoading}>{loading ? "Please wait..." : mode === "login" ? mfaRequired ? "Verify and enter Neptune" : "Enter Neptune" : "Create account and verify email"}</button>
      {mode === "login" && passkeySupported && <button className="btn" type="button" disabled={loading || passkeyLoading} onClick={passkeyLogin}>{passkeyLoading ? "Waiting for passkey..." : "Sign in with passkey"}</button>}
      {mode === "signup" && <p className="muted" style={{ margin: 0, fontSize: 11 }}>New organizations must verify the account email before signing in. Your trial follows the package selected above.</p>}
      {mode === "login" && passkeySupported && <p className="muted" style={{ margin: 0, fontSize: 11 }}>Passkeys use your device authenticator or security key and do not require entering your Neptune password.</p>}
      {message && <div className="form-message error">{message}{verificationEmail && <> <Link href={`/verify-email?email=${encodeURIComponent(verificationEmail)}`}>Resend verification</Link></>}</div>}
    </form>
  );
}
