import Link from "next/link";
import { VerifyEmailClient } from "@/components/VerifyEmailClient";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; email?: string; sent?: string; delivery?: string }> }) {
  const params = await searchParams;
  return <main className="auth-page">
    <section className="auth-card glass premium">
      <Link className="brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Verified operator identity</small></span></Link>
      <p className="eyebrow" style={{ marginTop: 28 }}>Identity verification</p>
      <h2>Confirm the operator email.</h2>
      <p className="muted">Neptune requires verified email ownership before a new organization account can access vessel records.</p>
      <VerifyEmailClient token={params.token} email={params.email} sent={params.sent === "1"} delivery={params.delivery} />
    </section>
  </main>;
}
