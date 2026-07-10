import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

const resources = [
  ["Captain Handover", "A structured command handover covering unresolved approvals, port-call status, safety risks, crew exceptions, and department priorities."],
  ["Hot Work Delegation", "Requester, gas test, Chief Officer review, Master authorization, evidence capture, and closeout chain."],
  ["Inspection Assignment", "Assign rounds by department, set deadlines, collect photos and notes, review exceptions, and close corrective actions."],
  ["PSC Readiness", "Certificates, evidence, photos, open actions, expiry risk, and inspection-ready document packs."],
  ["Engineering Queue", "Work orders, PMS, machinery defects, running hours, parts status, and closeout evidence."],
  ["Port Call Brief", "ETA, agent messages, cargo documents, crew changes, customs requirements, signatures, and readiness."],
  ["Crew Readiness", "STCW, medicals, contracts, watch cover, travel, and rest-hour exceptions."],
  ["Procurement Control", "Critical spares, RFQs, vendor comparison, approvals, delivery status, and vessel receiving."],
  ["Incident RCA", "Near miss reporting, severity, root cause analysis, corrective actions, owner, and verification."]
];

export default function ResourcesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero"><div className="container"><p className="eyebrow">Neptune Resources</p><h1>Operating playbooks built into the software.</h1><p className="lede">These resources define the workflows the dashboard enforces. They are designed for captains, Chief Engineers, Chief Officers, safety teams, fleet managers, and shore operations.</p><div className="hero-actions"><Link className="btn gold" href="/signup">Create workspace</Link><Link className="btn" href="/pricing">View plans</Link></div></div></section>
        <section className="section"><div className="container resource-grid">{resources.map(([title,text]) => <article className="card premium" key={title}><div className="icon">✦</div><h3>{title}</h3><p>{text}</p><Link className="btn" href="/signup">Use this workflow</Link></article>)}</div></section>
      </main>
    </>
  );
}
