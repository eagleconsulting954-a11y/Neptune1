import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="auth-page">
      <section className="auth-card glass premium">
        <Link className="brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Create organization</small></span></Link>
        <p className="eyebrow" style={{marginTop:28}}>14-day trial</p>
        <h2>Create your vessel command workspace.</h2>
        <p className="muted">Registration creates a private organization, administrator account, trial subscription, and isolated fleet workspace.</p>
        <AuthForm mode="signup" />
        <p className="muted">Already registered? <Link href="/login" style={{color:"var(--gold)"}}>Login</Link></p>
      </section>
    </main>
  );
}
