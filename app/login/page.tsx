import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const params = await searchParams;
  const resetComplete = params.reset === "success";

  return (
    <main className="auth-page">
      <section className="auth-card glass premium">
        <Link className="brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Secure operator login</small></span></Link>
        <p className="eyebrow" style={{ marginTop: 28 }}>Welcome back</p>
        <h2>Enter the command center.</h2>
        <p className="muted">Sign in with your organization account to access persistent CRM, fleet, analytics, and operational records.</p>
        {resetComplete && <div className="form-message success login-reset-success">Your password was updated. Sign in with the new password.</div>}
        <AuthForm mode="login" />
        <div className="login-help-row"><Link href="/forgot-password">Forgot password?</Link></div>
        <p className="muted">New organization? <Link href="/signup" style={{ color: "var(--gold)" }}>Create a workspace</Link></p>
      </section>
    </main>
  );
}
