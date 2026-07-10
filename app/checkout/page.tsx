import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CheckoutButton } from "@/components/CheckoutButton";

export default function CheckoutPage() {
  return (
    <>
      <SiteHeader />
      <main className="section">
        <div className="container checkout-grid">
          <section className="card premium">
            <p className="eyebrow">Secure Subscription</p>
            <h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>Unlock Neptune FleetOps.</h1>
            <p className="lede">Activate the production dashboard for captains, department heads, shore managers, fleet administrators, safety teams, and procurement.</p>
            <div className="payment-line"><span>Plan</span><b>FleetOps</b></div>
            <div className="payment-line"><span>Billing</span><b>Monthly</b></div>
            <div className="payment-line"><span>Users</span><b>Up to 5 administrators</b></div>
            <div className="payment-line"><span>Monthly total</span><b>$1,499</b></div>
            <CheckoutButton plan="fleetops" label="Continue to Stripe" />
          </section>
          <aside className="card">
            <p className="eyebrow">Included</p>
            <h2>Full operating workspace</h2>
            <ul className="price">
              <li>Fleet and vessel CRM</li>
              <li>Hot work and inspection delegation</li>
              <li>PMS and work orders</li>
              <li>Certificates and incidents</li>
              <li>Commercial CRM</li>
              <li>Stripe subscription management</li>
              <li>Multi-tenant PostgreSQL records</li>
              <li>Mobile command interface</li>
            </ul>
            <Link className="btn" href="/pricing">Compare plans</Link>
          </aside>
        </div>
      </main>
    </>
  );
}
