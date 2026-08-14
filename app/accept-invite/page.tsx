import Link from "next/link";
import { AcceptInviteClient } from "@/components/AcceptInviteClient";

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <main className="auth-page">
    <section className="auth-card glass premium">
      <Link className="brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Secure organization invitation</small></span></Link>
      <p className="eyebrow" style={{ marginTop: 28 }}>Organization access</p>
      <h2>Create your operator identity.</h2>
      <p className="muted">This one-time invitation creates a verified Neptune user inside the inviting organization and applies its assigned vessel permissions.</p>
      <AcceptInviteClient token={params.token || ""} />
    </section>
  </main>;
}
