import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { PLAN_CATALOG, type PlanKey } from "@/src/lib/plans";

const planOrder: PlanKey[] = ["captain", "fleetops", "full_vessel_access", "enterprise"];

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="section package-pricing-page">
        <div className="container">
          <p className="eyebrow">Commercial Plans</p>
          <h1>Buy only the operating suite your team needs.</h1>
          <p className="lede">Captain and FleetOps have separate module access. Full Vessel Access combines both packages into one complete ship-and-shore subscription.</p>
          <div className="package-comparison-note"><b>Package enforcement is active.</b><span>Modules outside the selected plan are hidden in the dashboard and blocked by protected APIs.</span></div>
          <div className="pricing-grid package-pricing-grid">
            {planOrder.map(key => {
              const plan = PLAN_CATALOG[key];
              const isFull = key === "full_vessel_access";
              const isEnterprise = key === "enterprise";
              return (
                <article className={`price card premium package-price-card ${isFull ? "featured" : ""}`} key={plan.key}>
                  {isFull && <span className="package-featured-label">Complete Neptune suite</span>}
                  <p className="eyebrow">{plan.note}</p>
                  <h3>{plan.name}</h3>
                  <div className="package-price"><strong>{plan.priceLabel}</strong>{!isEnterprise && <span>/ month</span>}</div>
                  <p>{plan.description}</p>
                  <div className="package-access-section"><b>Included access</b><ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul></div>
                  {plan.excluded.length > 0 && <div className="package-access-section excluded"><b>Not included</b><ul>{plan.excluded.map(feature => <li key={feature}>{feature}</li>)}</ul></div>}
                  <Link className={`btn ${isFull ? "gold" : ""}`} href={isEnterprise ? "/signup?plan=enterprise" : `/signup?plan=${plan.slug}`}>{isEnterprise ? "Start enterprise setup" : `Start ${plan.shortName} trial`}</Link>
                  {!isEnterprise && <Link className="package-direct-checkout" href={`/checkout?plan=${plan.slug}`}>Already registered? Buy this package</Link>}
                </article>
              );
            })}
          </div>
          <section className="package-combined-explainer glass">
            <div><p className="eyebrow">Full Vessel Access Package</p><h2>Captain + FleetOps = $1,998 per month.</h2></div>
            <p>This package combines the $499 Captain suite and the $1,499 FleetOps suite without removing any module. It is the required package for complete onboard command, voyage intelligence, maintenance, incidents, CRM, and fleet analytics in one workspace.</p>
            <Link className="btn gold" href="/checkout?plan=full-vessel-access">Buy Full Vessel Access</Link>
          </section>
        </div>
      </main>
    </>
  );
}
