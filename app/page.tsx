import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

const modules = [
  ["Command", "Fleet oversight, vessel accounts, approvals, readiness, and executive risk."],
  ["Voyage Operations", "Voyages, navigation, cargo, port calls, ETA windows, and agent coordination."],
  ["Crew", "Crew lists, certificates, medicals, travel, watch schedules, and rest-hour visibility."],
  ["Maintenance", "PMS, work orders, machinery, critical spares, inventory, and purchasing."],
  ["Safety & Compliance", "PTW, inspections, incidents, eORB, certificates, evidence, and audit history."],
  ["Delegation", "Assign hot work and inspection duties with owners, deadlines, approvals, and closeout evidence."]
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero" id="platform">
          <div className="container hero-grid">
            <div>
              <p className="eyebrow">Production Vessel Command Software</p>
              <h1>Run vessel operations from one premium command center.</h1>
              <p className="lede">Neptune is a full-stack maritime CRM and operating system for captains, heads of department, fleet managers, safety teams, engineers, crewing, and procurement. It replaces disconnected spreadsheets, email chains, and document folders with one accountable workflow.</p>
              <div className="hero-actions">
                <Link className="btn gold" href="/signup">Start free trial</Link>
                <Link className="btn" href="/pricing">View pricing</Link>
                <Link className="btn" href="/login">Open dashboard</Link>
              </div>
              <div className="trust"><span>Multi-tenant accounts</span><span>Stripe billing</span><span>PostgreSQL backend</span><span>Mobile-first</span></div>
            </div>
            <div className="hero-console glass premium">
              <div className="console-top"><button>☰</button><span>Search vessels, PTW, crew, certificates...</span><button>🔔</button></div>
              <div className="console-head"><p className="eyebrow">Live Command Center</p><h3>Every vessel, approval, and risk signal.</h3></div>
              <div className="mini-kpis"><div><b>6</b><span>Active vessels</span></div><div><b>97%</b><span>Fleet readiness</span></div><div><b>3</b><span>Pending approvals</span></div><div><b>38h</b><span>Next ETA</span></div></div>
              <div className="radar" />
            </div>
          </div>
        </section>

        <section className="section" id="modules">
          <div className="container">
            <div className="section-head"><div><p className="eyebrow">Core Modules</p><h2>Built around how vessels actually operate.</h2></div><p>Every module shares the same vessel record, organization, users, permissions, activity stream, subscription, and audit context.</p></div>
            <div className="grid-3">{modules.map(([title, text]) => <article className="card premium" key={title}><div className="icon">✦</div><h3>{title}</h3><p>{text}</p></article>)}</div>
          </div>
        </section>

        <section className="section">
          <div className="container footer-cta glass premium"><div><p className="eyebrow">Ready for commercial deployment</p><h2>Start with one vessel. Scale to the fleet.</h2><p className="lede">Create an organization, invite the operating team, connect Stripe, and begin recording real vessel work.</p></div><Link className="btn gold" href="/signup">Create Neptune workspace</Link></div>
        </section>
      </main>
    </>
  );
}
