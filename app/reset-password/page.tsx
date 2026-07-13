import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = String(params.token || "");

  return (
    <main className="auth-page password-reset-page">
      <section className="auth-card glass premium password-reset-card">
        <Link className="brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Secure account recovery</small></span></Link>
        <p className="eyebrow" style={{ marginTop: 28 }}>Choose a new password</p>
        <h2>Restore secure access.</h2>
        <p className="muted">Set a new password for your Neptune account. Each reset link can be used only once.</p>
        <ResetPasswordForm token={token} />
        <div className="password-help-row"><Link href="/login">Return to sign in</Link><Link href="/forgot-password">Request another link</Link></div>
      </section>
    </main>
  );
}
