import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card glass premium">
        <Link className="brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Secure operator login</small></span></Link>
        <p className="eyebrow" style={{marginTop:28}}>Welcome back</p>
        <h2>Enter the command center.</h2>
        <p className="muted">Sign in with your organization account to access persistent CRM, fleet, analytics, and operational records.</p>
        <AuthForm mode="login" />
        <p className="muted">New organization? <Link href="/signup" style={{color:"var(--gold)"}}>Create a workspace</Link></p>
      </section>
    </main>
  );
}
