import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

const plans = [
  { name: "Captain", price: "$499", note: "One vessel workspace", features: ["Captain command dashboard", "Delegation duties", "Certificates", "Resources library"] },
  { name: "FleetOps", price: "$1,499", note: "Fleet operating team", features: ["Up to 5 administrators", "Vessels, CRM, maintenance", "PTW and inspection delegation", "Incidents and activity logs"] },
  { name: "Enterprise", price: "Custom", note: "Multi-fleet deployment", features: ["Unlimited organizations", "Custom roles and onboarding", "Data migration", "Priority support and integrations"] }
];

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="section">
        <div className="container">
          <p className="eyebrow">Commercial Plans</p>
          <h1>Sell Neptune by vessel, fleet, or enterprise.</h1>
          <p className="lede">Each plan includes secure login, organization isolation, the premium command UI, mobile access, and the full-stack operational record system.</p>
          <div className="pricing-grid" style={{marginTop:28}}>{plans.map(plan => <article className="price card premium" key={plan.name}><p className="eyebrow">{plan.note}</p><h3>{plan.name}</h3><strong>{plan.price}</strong><span className="muted"> / month</span><ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul><Link className="btn gold" href={plan.name === "Enterprise" ? "/signup" : "/checkout"}>{plan.name === "Enterprise" ? "Start enterprise setup" : `Choose ${plan.name}`}</Link></article>)}</div>
        </div>
      </main>
    </>
  );
}
