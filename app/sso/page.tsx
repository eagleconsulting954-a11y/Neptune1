import Link from "next/link";
import { oidcConfigured } from "@/src/lib/server/oidc-sso";

const errors: Record<string, string> = {
  SSO_STATE_INVALID: "The SSO session expired or could not be validated. Start again.",
  SSO_ACCOUNT_NOT_PROVISIONED: "Your identity provider authenticated you, but this email has not been provisioned as an active Neptune user.",
  SSO_VERIFIED_EMAIL_REQUIRED: "The identity provider did not return a verified email address.",
  SSO_TOKEN_EXCHANGE_FAILED: "The identity provider could not complete the authorization exchange.",
  missing_callback: "The identity provider callback was incomplete."
};

export default async function SsoPage({ searchParams }: { searchParams: Promise<{ from?: string; error?: string }> }) {
  const params = await searchParams;
  const configured = oidcConfigured();
  const error = params.error ? errors[params.error] || "Enterprise SSO could not complete." : "";
  const from = params.from && params.from.startsWith("/") && !params.from.startsWith("//") ? params.from : "/dashboard";
  return <main className="auth-page"><section className="auth-card glass premium">
    <Link className="brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Enterprise identity</small></span></Link>
    <p className="eyebrow" style={{ marginTop: 28 }}>OpenID Connect SSO</p>
    <h2>Use your company identity provider.</h2>
    <p className="muted">Neptune accepts SSO only for users that are already provisioned and active in the organization. Identity-provider authentication does not grant roles, vessel access, CRM, or platform-admin permissions.</p>
    {error && <div className="form-message error">{error}</div>}
    {configured ? <a className="btn gold" href={`/api/auth/sso/start?from=${encodeURIComponent(from)}`}>Continue with enterprise SSO</a> : <div className="form-message">Enterprise SSO is available in the application but is disabled until your deployment is configured with an approved OpenID Connect provider.</div>}
    <div className="login-help-row"><Link href="/login">Use Neptune login instead</Link></div>
  </section></main>;
}
