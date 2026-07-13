import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page password-reset-page">
      <section className="auth-card glass premium password-reset-card">
        <Link className="brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Secure account recovery</small></span></Link>
        <p className="eyebrow" style={{ marginTop: 28 }}>Forgot password</p>
        <h2>Recover your Neptune account.</h2>
        <p className="muted">Enter the email used for your Neptune workspace. We will send a one-time password reset link that expires after 30 minutes.</p>
        <ForgotPasswordForm />
        <div className="password-help-row"><Link href="/login">Return to sign in</Link><Link href="/signup">Create a workspace</Link></div>
      </section>
    </main>
  );
}
