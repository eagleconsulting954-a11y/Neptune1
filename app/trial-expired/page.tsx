import Link from "next/link";
import { CheckoutButton } from "@/components/CheckoutButton";

export default function TrialExpiredPage() {
  return (
    <main className="trial-expired-page">
      <section className="trial-expired-card glass premium">
        <div className="brand"><span className="brand-mark">✦</span><span>NEPTUNE<small>Vessel Command CRM</small></span></div>
        <p className="eyebrow">14-Day Trial Complete</p>
        <h1>Your Neptune workspace is paused.</h1>
        <p className="lede">The trial automatically ends exactly 14 days after registration. Your organization and operational records remain stored, but dashboard and API access stay locked until an active subscription is confirmed.</p>
        <div className="trial-expired-grid">
          <article><span>Workspace status</span><b>Paused</b><p>No records are deleted when the trial ends.</p></article>
          <article><span>Access control</span><b>Automatic</b><p>Dashboard, admin, CRM, and operational APIs are blocked.</p></article>
          <article><span>Restore access</span><b>Immediate</b><p>Verified Stripe payment reactivates the workspace.</p></article>
        </div>
        <CheckoutButton plan="fleetops" label="Activate Neptune FleetOps" />
        <div className="actions trial-secondary-actions">
          <Link className="btn" href="/pricing">Compare plans</Link>
          <Link className="btn" href="/demo">Use the public demo</Link>
          <Link className="btn" href="/login">Sign in again</Link>
        </div>
      </section>
    </main>
  );
}
