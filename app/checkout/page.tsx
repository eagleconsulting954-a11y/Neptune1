import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CheckoutButton } from "@/components/CheckoutButton";
import { normalizePlan, PLAN_CATALOG } from "@/src/lib/plans";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const params = await searchParams;
  const planKey = normalizePlan(params.plan || "captain");
  const plan = PLAN_CATALOG[planKey];
  const isEnterprise = plan.price === null;

  return (
    <>
      <SiteHeader />
      <main className="section">
        <div className="container checkout-grid">
          <section className="card premium">
            <p className="eyebrow">Secure Subscription</p>
            <h1 style={{ fontSize: "clamp(40px,6vw,68px)" }}>Activate {plan.name}.</h1>
            <p className="lede">{plan.description}</p>
            <div className="package-checkout-summary">
              <div className="payment-line"><span>Package</span><b>{plan.name}</b></div>
              <div className="payment-line"><span>Billing</span><b>{isEnterprise ? "Implementation agreement" : "Monthly subscription"}</b></div>
              <div className="payment-line"><span>Vessel access</span><b>{plan.limits.vessels === null ? "Multi-vessel" : `${plan.limits.vessels} vessel`}</b></div>
              <div className="payment-line"><span>Administrators</span><b>{plan.limits.administrators === null ? "Custom" : `Up to ${plan.limits.administrators}`}</b></div>
              <div className="payment-line"><span>Monthly total</span><b>{plan.priceLabel}</b></div>
            </div>
            {isEnterprise
              ? <Link className="btn gold" href="/signup?plan=enterprise">Start enterprise setup</Link>
              : <CheckoutButton plan={plan.key} label={`Continue to Stripe · ${plan.priceLabel}`} />}
          </section>
          <aside className="card">
            <p className="eyebrow">Included in this package</p>
            <h2>{plan.shortName} access</h2>
            <ul className="price package-checkout-included">{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
            {plan.excluded.length > 0 && <><p className="eyebrow" style={{ marginTop: 20 }}>Requires Full Vessel Access</p><ul className="price">{plan.excluded.map(feature => <li key={feature}>{feature}</li>)}</ul></>}
            <Link className="btn" href="/pricing">Compare all packages</Link>
          </aside>
        </div>
      </main>
    </>
  );
}
