import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { PLAN_CATALOG, type PlanKey } from "@/src/lib/plans";

const riskCards = [
  ["A certificate expires quietly", "The record exists, but the warning lives in another file or inbox."],
  ["Critical work has no clear owner", "A task is discussed, but nobody can see responsibility, due time, and closeout together."],
  ["Fleet leaders see activity, not priority", "More reports do not help when the next decision is still unclear."],
  ["Voyage information is scattered", "Weather, port, bunker, and emergency information are checked in separate places."],
  ["The audit trail starts too late", "Evidence is reconstructed after the event instead of captured while the work happens."]
];

const desiredOutcomes = [
  ["Protect people and the vessel", "Bring risks, responsibilities, and evidence into one accountable operating view."],
  ["Prevent avoidable surprises", "See certificate windows, open work, incidents, and critical assignments before they become urgent."],
  ["Stay in control under pressure", "Give captains and shore teams the same current record and the same next actions."]
];

const process = [
  ["01", "Your team enters real records", "Vessels, duties, maintenance, certificates, incidents, CRM accounts, ports, and voyage plans stay inside the organization workspace."],
  ["02", "Neptune checks the included modules", "The platform reads only the records and tools available in the selected Captain, FleetOps, Full Vessel Access, or Enterprise package."],
  ["03", "Operational signals are calculated", "Readiness, open work, compliance windows, incidents, port intelligence, and commercial activity are evaluated from current data."],
  ["04", "The most important issues rise first", "Critical alerts and next-best recommendations are ranked so the team can act instead of searching."],
  ["05", "Ownership and evidence stay attached", "The responsible person, status, deadline, and activity history remain connected to the record."]
];

const operatingModules = [
  ["Command", "See fleet trends, critical alerts, and recommended next actions."],
  ["Vessels", "Keep the operating record, readiness, status, IMO, and ETA in one place."],
  ["Maritime Intelligence", "Check weather, ocean conditions, ports, congestion, bunker plans, and verified MRCC contacts."],
  ["Delegation", "Assign hot work and inspections with an owner, deadline, approval, and closeout."],
  ["Maintenance", "Track work orders, priority, engineering ownership, and due dates."],
  ["Certificates", "See expiry windows and keep certificate evidence connected to the vessel."],
  ["Incidents", "Record severity, ownership, status, root-cause work, and corrective actions."],
  ["CRM & Analytics", "Manage accounts, pipeline, fleet activity, and shore-side operating insight."]
];

const faq = [
  ["Does every trial include the complete product?", "No. The 14-day trial follows the package selected at signup. Modules outside that package are hidden in the dashboard and blocked by protected APIs."],
  ["Will Neptune add sample information to my workspace?", "No. New workspaces start empty. Dashboard totals, alerts, trends, and recommendations begin with information entered by your organization."],
  ["What happens after 14 days?", "The workspace is automatically paused. Your records stay stored, and access returns after an active subscription is confirmed."],
  ["Is Maritime Intelligence a navigation system?", "No. It supports planning and operational awareness. It does not replace official bridge systems, charts, GMDSS, VTS, NAVTEX, SafetyNET, ECDIS, or required maritime procedures."],
  ["Can one subscription unlock both onboard and shore-side tools?", "Yes. Full Vessel Access combines the Captain and FleetOps packages into one subscription with the complete Neptune module set."]
];

const packageOrder: PlanKey[] = ["captain", "fleetops", "full_vessel_access"];

export default function HomePage() {
  return (
    <div className="psych-landing">
      <SiteHeader />
      <main>
        <section className="psych-hero" id="platform">
          <div className="container psych-hero-grid">
            <div className="psych-hero-copy">
              <div className="psych-proof-line"><span>Built for captains and fleet operators</span><i /> <span>Real organization data only</span></div>
              <p className="eyebrow">Vessel decisions without blind spots</p>
              <h1>Protect the vessel, crew, and schedule—without running operations from scattered files.</h1>
              <p className="lede">Neptune gives captains and fleet teams one place to see what needs attention, who owns it, and what should happen next. Every alert and recommendation comes from your organization’s own records.</p>
              <div className="hero-actions">
                <Link className="btn gold psych-primary-cta" href="/signup">Start a 14-day package trial</Link>
                <Link className="btn" href="/demo">See the product flow</Link>
                <Link className="psych-text-link" href="/pricing">Compare package access →</Link>
              </div>
              <div className="psych-reassurance">
                <span><b>Clean workspace</b>No sample records</span>
                <span><b>Exact access</b>Only purchased modules</span>
                <span><b>Automatic control</b>14-day cutoff</span>
              </div>
            </div>

            <div className="psych-command-preview glass premium" aria-label="How Neptune turns vessel records into decisions">
              <div className="psych-preview-head">
                <div><p className="eyebrow">Visible operating process</p><h2>From records to the next decision.</h2></div>
                <span className="psych-live-pill"><i /> ORGANIZATION DATA</span>
              </div>
              <div className="psych-processing-list">
                <div className="complete"><span>01</span><div><b>Read included records</b><small>Vessels, work, compliance, incidents, ports, and accounts</small></div><strong>✓</strong></div>
                <div className="complete"><span>02</span><div><b>Check operating conditions</b><small>Status, ownership, deadlines, severity, readiness, and evidence</small></div><strong>✓</strong></div>
                <div className="active"><span>03</span><div><b>Rank risk and urgency</b><small>Critical issues move ahead of routine activity</small></div><strong>•••</strong></div>
                <div><span>04</span><div><b>Build next-best actions</b><small>Recommendations stay connected to the responsible module</small></div><strong>→</strong></div>
              </div>
              <div className="psych-preview-output">
                <article><span>Decision outlook</span><b>Know what requires attention now</b><small>Based on the records your team maintains</small></article>
                <article><span>Accountability</span><b>Owner, deadline, status, evidence</b><small>One operating trail from assignment to closeout</small></article>
              </div>
            </div>
          </div>
        </section>

        <section className="psych-signal-strip" aria-label="Neptune product assurances">
          <div className="container">
            <span>PostgreSQL organization isolation</span>
            <span>Protected package APIs</span>
            <span>Decision alerts from real records</span>
            <span>Stripe subscription support</span>
            <span>Mobile vessel workflow</span>
          </div>
        </section>

        <section className="section psych-problem-section">
          <div className="container">
            <div className="psych-section-intro">
              <div><p className="eyebrow">The cost of fragmented operations</p><h2>The next preventable issue is usually already recorded somewhere.</h2></div>
              <p>The problem is not effort. It is that information, ownership, and urgency live in different places. Neptune brings them into the same decision flow.</p>
            </div>
            <div className="psych-risk-grid">{riskCards.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
          </div>
        </section>

        <section className="section psych-desire-section">
          <div className="container psych-desire-grid">
            <div className="psych-desire-copy">
              <p className="eyebrow">What teams are really buying</p>
              <h2>Operational calm when the pressure rises.</h2>
              <p className="lede">Software features matter only when they help the team protect people, avoid preventable loss, and prove that the vessel is under control.</p>
              <Link className="btn gold" href="/signup?plan=full-vessel-access">Build the full operating view</Link>
            </div>
            <div className="psych-outcome-list">{desiredOutcomes.map(([title, text], index) => <article key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
          </div>
        </section>

        <section className="section psych-process-section">
          <div className="container">
            <div className="psych-section-intro">
              <div><p className="eyebrow">See the work behind the answer</p><h2>Neptune does not hide the operating process.</h2></div>
              <p>Teams trust a recommendation when they can see what information feeds it. Neptune makes the path from record to action clear.</p>
            </div>
            <div className="psych-process-timeline">{process.map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
          </div>
        </section>

        <section className="section psych-modules-section" id="modules">
          <div className="container">
            <div className="psych-section-intro">
              <div><p className="eyebrow">Clear tools. Plain purpose.</p><h2>Every module answers an operating question.</h2></div>
              <p>No jargon-heavy feature wall. Each part of Neptune exists to make a vessel or fleet decision easier to understand and easier to own.</p>
            </div>
            <div className="psych-module-grid">{operatingModules.map(([title, text], index) => <article className="card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
          </div>
        </section>

        <section className="section psych-packages-section">
          <div className="container">
            <div className="psych-section-intro">
              <div><p className="eyebrow">Know exactly what the price includes</p><h2>Choose onboard, shore-side, or complete vessel access.</h2></div>
              <p>Package boundaries are enforced in the interface and on the server. Customers receive only the modules listed for the selected package.</p>
            </div>
            <div className="psych-package-grid">
              {packageOrder.map(key => {
                const plan = PLAN_CATALOG[key];
                const featured = key === "full_vessel_access";
                return <article className={`psych-package-card glass ${featured ? "featured" : ""}`} key={key}>
                  {featured && <span className="psych-recommended">Complete suite</span>}
                  <p className="eyebrow">{plan.note}</p>
                  <h3>{plan.name}</h3>
                  <div className="psych-package-price"><b>{plan.priceLabel}</b><span>/ month</span></div>
                  <p>{plan.description}</p>
                  <div className="psych-included-list"><strong>What your team gets</strong>{plan.features.slice(0, 7).map(feature => <span key={feature}>✓ {feature}</span>)}</div>
                  {plan.excluded.length > 0 && <div className="psych-excluded-line"><b>Not included:</b> {plan.excluded.join(" · ")}</div>}
                  <Link className={`btn ${featured ? "gold" : ""}`} href={`/signup?plan=${plan.slug}`}>Start {plan.shortName} trial</Link>
                </article>;
              })}
            </div>
            <div className="psych-package-note"><b>Need every onboard and fleet module?</b><span>Full Vessel Access combines Captain and FleetOps for $1,998 per month.</span><Link href="/pricing">See the complete comparison →</Link></div>
          </div>
        </section>

        <section className="section psych-proof-section">
          <div className="container psych-proof-grid">
            <div>
              <p className="eyebrow">Product proof before promises</p>
              <h2>See the boundaries. See the workflow. Then decide.</h2>
              <p className="lede">Neptune makes the important details visible before signup: package access, clean workspaces, trial limits, data sources, safety limitations, and the actual product flow.</p>
              <div className="hero-actions"><Link className="btn gold" href="/demo">Open the interactive demo</Link><Link className="btn" href="/pricing">Review exact pricing</Link></div>
            </div>
            <div className="psych-proof-checks">
              <article><b>Real-data dashboard</b><span>No synthetic vessel records are inserted into customer workspaces.</span></article>
              <article><b>Server-side package control</b><span>Hidden modules cannot be reached through protected APIs.</span></article>
              <article><b>Visible trial status</b><span>Customers see package name and remaining trial time.</span></article>
              <article><b>Planning limits stated clearly</b><span>Maritime Intelligence is not represented as official navigation equipment.</span></article>
            </div>
          </div>
        </section>

        <section className="section psych-faq-section">
          <div className="container">
            <div className="psych-section-intro"><div><p className="eyebrow">Remove uncertainty before signup</p><h2>Direct answers to the questions that stop a decision.</h2></div></div>
            <div className="psych-faq-list">{faq.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
          </div>
        </section>

        <section className="section psych-final-section">
          <div className="container psych-final-cta glass premium">
            <div><p className="eyebrow">Do not wait for the missing record to become the incident</p><h2>Put the next vessel decision where the whole team can see it.</h2><p>Start with the package your team needs. Neptune will keep every other module outside the workspace until the subscription includes it.</p></div>
            <div className="psych-final-actions"><Link className="btn gold" href="/signup">Start the 14-day trial</Link><Link className="btn" href="/pricing">Choose the right package</Link><small>Workspace access pauses automatically when the trial ends.</small></div>
          </div>
        </section>
      </main>
    </div>
  );
}
