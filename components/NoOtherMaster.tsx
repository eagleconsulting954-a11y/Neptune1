"use client";

import { useState } from "react";

type Props = {
  openTab: (tab: string) => void;
};

const TRANSITS = [
  { area: "Suez Canal", risks: "Bank effect, fines, congestion", protocol: "2 pilots, SCA rules, no overtaking", action: "Pilot booking and speed log" },
  { area: "Gulf of Hormuz", risks: "Boarding, GPS spoofing", protocol: "Daylight transit, maximum speed, UKMTO", action: "Auto UKMTO email and AIS toggle" },
  { area: "Red Sea / Bab el Mandeb", risks: "Drones, missiles", protocol: "MSCHOA + UKMTO, BMP5, citadel drill", action: "Incident form and guard log" },
  { area: "Panama Canal", risks: "Delays, locks, weather", protocol: "Book slot and line handlers", action: "Weather API and slot tracker" },
  { area: "Bosphorus Strait", risks: "Traffic, strong currents", protocol: "Turkish pilot, VHF Ch12/13", action: "e-Pilot booking and speed alert" },
  { area: "Baltic Sea", risks: "Ice, mines, GPS jamming", protocol: "Ice class and NAVTEX", action: "Ice report and MRCC contacts" },
  { area: "Kiel Canal", risks: "Narrow waterway, heavy traffic", protocol: "Canal pilot and speed 8–12 knots", action: "Transit timer and anchor alert" }
];

const DISTRESS_CONTACTS = [
  ["1", "Nearest MRCC", "VHF Ch16 / DSC"],
  ["2", "UKMTO", "+44 2392 222060 · ukmto@dmc.ae"],
  ["3", "MSCHOA", "Red Sea / Gulf"],
  ["4", "Company DPA + CSO", "24/7 organization contact"],
  ["5", "Flag State RCC", "Via LRIT"],
  ["6", "ITF / ISWAN", "+44 20 7323 2737"],
  ["7", "Embassy / Consulate", "By nationality"]
];

const SUPPORT_ORGANIZATIONS = [
  ["ITF", "Abandonment, wages, contracts", "http://itf.org.uk"],
  ["ISWAN SeafarerHelp", "24/7 emotional and medical support", "+44 20 7323 2737"],
  ["Mission to Seafarers", "Port welfare", "Global network"],
  ["P&I Club", "Medical and repatriation", "Via DPA"],
  ["IMO GISIS", "Incident reporting", "http://gisis.imo.org"]
];

const TRACKING_SYSTEMS = ["LRIT", "AIS", "VSAT / Iridium", "Digital SID", "EPIRB / SART / PLB", "Crew app", "Wearables"];
const TRACKER_KPIS = ["Vessel location", "Crew health %", "Incident heatmap", "Compliance %"];

const INSURANCE_REQUIREMENTS = [
  "Shipowner Liability",
  "P&I",
  "GPA $75K–$150K",
  "Medical",
  "Kidnap & Ransom plus War Risk"
];

const FAMILY_CARE = [
  ["Death", "4 months wages"],
  ["Disability", "ILO percentage"],
  ["Abandonment", "4 months wages plus repatriation within 30 days"],
  ["Repatriation", "Free"]
];

const SEA_REQUIREMENTS = ["Wages", "Leave at 2.5 days per month", "Maximum hours", "Medical", "Repatriation", "Complaints procedure"];

export function NoOtherMaster({ openTab }: Props) {
  const [view, setView] = useState("Transit Protocols");
  const tabs = ["Transit Protocols", "Distress Response", "Support Organizations", "Seafarer Tracker", "Insurance & Family", "SaaS Implementation"];

  return <div className="ev-future-shell">
    <section className="ev-future-hero">
      <div>
        <p className="eyebrow">The Deep Thinking Guide to Seafarer Safety, Insurance & SaaS Compliance 2026</p>
        <h1>No Other Master</h1>
        <p><b>Leaving No One Behind.</b> A controlled workspace for high-risk transit, emergency response, crew welfare, identity tracking, insurance, family care, and implementation governance.</p>
        <p className="muted">Prepared by Captain Jaspal Rajput · 2026</p>
      </div>
      <div className="ev-energy-orbit" aria-hidden="true"><span>CREW</span><span>FAMILY</span><span>VESSEL</span><b>SAFE</b></div>
    </section>

    <div className="ev-warning-banner"><b>Operational reference requiring verification.</b><span>This workspace preserves the supplied 2026 guide. Contact details, transit instructions, compensation figures, legal duties, insurance limits, and reporting requirements must be checked against current company procedures, official authorities, contracts, flag requirements, and professional advice before use.</span></div>

    <nav className="ev-tabs">{tabs.map(item => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</nav>

    {view === "Transit Protocols" && <div className="ev-section-stack">
      <section className="ev-panel">
        <div className="ev-panel-head"><div><p className="eyebrow">Module 1 · Operations, Masters, Bridge Team</p><h2>High-Risk Transit Protocols</h2><p>SaaS direction: geofence plus digital checklist.</p></div><button className="btn gold" onClick={() => openTab("Maritime Intel")}>Open Maritime Intel</button></div>
        <div className="data-grid"><table><thead><tr><th>Area</th><th>Key risks</th><th>Mandatory protocol</th><th>SaaS action</th></tr></thead><tbody>{TRANSITS.map(row => <tr key={row.area}><td><b>{row.area}</b></td><td>{row.risks}</td><td>{row.protocol}</td><td>{row.action}</td></tr>)}</tbody></table></div>
      </section>
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">Neptune Workflow</p><h2>Route the transit into active modules</h2></div></div><div className="ev-concept-grid"><article><h3>Location and weather</h3><p>Use Maritime Intelligence for route conditions, ports, weather, ocean data, congestion, and verified MRCC records.</p><button className="btn" onClick={() => openTab("Maritime Intel")}>Open intelligence</button></article><article><h3>Bridge checklist</h3><p>Create Navigation and Safety duties with an owner, location, severity, due time, and closeout trail.</p><button className="btn" onClick={() => openTab("Delegation")}>Open delegation</button></article><article><h3>Transit evidence</h3><p>Retain speed, pilot, guard, weather, slot, and incident records in the organization activity trail.</p><button className="btn" onClick={() => openTab("Activity")}>Open activity</button></article></div></section>
    </div>}

    {view === "Distress Response" && <div className="ev-section-stack">
      <section className="ev-panel">
        <div className="ev-panel-head"><div><p className="eyebrow">Module 2 · Bridge, DPA, CSO</p><h2>Distress & Emergency Response</h2><p>SaaS direction: one-click distress, live GPS, photo upload, muster status, and automatic logbook.</p></div><button className="btn gold" onClick={() => openTab("Incidents")}>Open incidents</button></div>
        <div className="ev-numbered-list">{DISTRESS_CONTACTS.map(([number, name, contact]) => <article key={number}><span>{number}</span><p><b>{name}</b><br />{contact}</p></article>)}</div>
      </section>
      <section className="ev-concept-grid"><article><p className="eyebrow">Position and rescue</p><h3>Nearest verified response</h3><p>Use Maritime Intelligence to locate saved MRCC/JRCC contacts and route context.</p><button className="btn" onClick={() => openTab("Maritime Intel")}>Open MRCC tools</button></article><article><p className="eyebrow">Event record</p><h3>Open the incident trail</h3><p>Record severity, responsible owner, corrective action, status, and supporting evidence.</p><button className="btn" onClick={() => openTab("Incidents")}>Record incident</button></article><article><p className="eyebrow">Muster and assignments</p><h3>Assign emergency duties</h3><p>Use the delegation workflow to assign Safety or Navigation actions and retain closeout responsibility.</p><button className="btn" onClick={() => openTab("Delegation")}>Assign response</button></article></section>
    </div>}

    {view === "Support Organizations" && <div className="ev-section-stack">
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">Module 3 · Crew, HR, Welfare</p><h2>Support Organizations</h2><p>SaaS direction: directory plus case tracker.</p></div><button className="btn gold" onClick={() => openTab("CRM")}>Open directory workspace</button></div><div className="data-grid"><table><thead><tr><th>Organization</th><th>Handles</th><th>Contact</th></tr></thead><tbody>{SUPPORT_ORGANIZATIONS.map(([organization, handles, contact]) => <tr key={organization}><td><b>{organization}</b></td><td>{handles}</td><td>{contact.startsWith("http") ? <a href={contact} target="_blank" rel="noreferrer">{contact}</a> : contact}</td></tr>)}</tbody></table></div></section>
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">Case Handling</p><h2>Keep welfare support accountable</h2></div></div><div className="ev-concept-grid"><article><h3>Organization directory</h3><p>Use CRM records for support organizations, named contacts, email, stage, and relationship history.</p><button className="btn" onClick={() => openTab("CRM")}>Open CRM</button></article><article><h3>Safety or welfare case</h3><p>Use Incidents for severity, ownership, corrective action, monitoring, resolution, and closeout.</p><button className="btn" onClick={() => openTab("Incidents")}>Open case tracker</button></article><article><h3>Audit trail</h3><p>Use Activity to retain contact, escalation, decision, and follow-up events.</p><button className="btn" onClick={() => openTab("Activity")}>Open activity</button></article></div></section>
    </div>}

    {view === "Seafarer Tracker" && <div className="ev-section-stack">
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">Module 4 · Fleet, IT, Security</p><h2>Seafarers Tracker & GPS Identity</h2><p>SaaS direction: live map plus geofence.</p></div><button className="btn gold" onClick={() => openTab("Vessels")}>Open vessel records</button></div><div className="ev-concept-grid"><article><p className="eyebrow">Tracking systems</p><h3>Identity and location inputs</h3><div className="ev-check-list">{TRACKING_SYSTEMS.map(item => <span key={item}>□ {item}</span>)}</div></article><article><p className="eyebrow">Dashboard KPIs</p><h3>Required operating signals</h3><div className="ev-check-list">{TRACKER_KPIS.map(item => <span key={item}>□ {item}</span>)}</div></article><article><p className="eyebrow">Software boundary</p><h3>Connected, not invented</h3><p>Neptune should display only verified vessel, crew, device, and incident records supplied by the organization or an approved provider.</p></article></div></section>
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">Neptune Usage</p><h2>Combine identity, vessel position, and incident context</h2></div></div><div className="ev-concept-grid"><article><h3>Vessel identity</h3><p>Use Vessels for the owned vessel record, status, readiness, IMO, and ETA.</p><button className="btn" onClick={() => openTab("Vessels")}>Open vessels</button></article><article><h3>Location context</h3><p>Use Maritime Intelligence for searched coordinates, weather, ports, MRCC, and route planning support.</p><button className="btn" onClick={() => openTab("Maritime Intel")}>Open map tools</button></article><article><h3>Security event</h3><p>Use Incidents to record GPS jamming, spoofing, device loss, unauthorized boarding, or tracking failure.</p><button className="btn" onClick={() => openTab("Incidents")}>Open incidents</button></article></div></section>
    </div>}

    {view === "Insurance & Family" && <div className="ev-section-stack">
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">Module 5 · HR, Legal, Families · IMO / MLC 2006</p><h2>Insurance, Contracts & Family Care</h2><p>SaaS direction: vault plus claims portal.</p></div><button className="btn gold" onClick={() => openTab("Certificates")}>Open certificate vault</button></div><div className="ev-concept-grid"><article><p className="eyebrow">Mandatory insurance</p><h3>Coverage register</h3><div className="ev-check-list">{INSURANCE_REQUIREMENTS.map(item => <span key={item}>□ {item}</span>)}</div></article><article><p className="eyebrow">Family compensation</p><h3>Guide figures</h3><div className="ev-check-list">{FAMILY_CARE.map(([type, value]) => <span key={type}><b>{type}:</b> {value}</span>)}</div></article><article><p className="eyebrow">SEA must include</p><h3>Contract checklist</h3><div className="ev-check-list">{SEA_REQUIREMENTS.map(item => <span key={item}>□ {item}</span>)}</div></article></div></section>
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">Neptune Usage</p><h2>Control evidence, claims, and contacts</h2></div></div><div className="ev-concept-grid"><article><h3>Certificate expiry</h3><p>Use Certificates for insurance, medical, contractual, and compliance evidence with issuer, expiry, and status.</p><button className="btn" onClick={() => openTab("Certificates")}>Open certificates</button></article><article><h3>Insurer and family contacts</h3><p>Use CRM for P&I, insurer, legal, welfare, nominee, and family contact records.</p><button className="btn" onClick={() => openTab("CRM")}>Open CRM</button></article><article><h3>Claim chronology</h3><p>Use Activity and Incidents for claim events, evidence, decisions, corrective actions, and resolution history.</p><button className="btn" onClick={() => openTab("Activity")}>Open audit trail</button></article></div></section>
    </div>}

    {view === "SaaS Implementation" && <div className="ev-section-stack">
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">Module 6 · Management, Owners</p><h2>SaaS Implementation</h2><p>SaaS direction: analytics plus audit.</p></div><button className="btn gold" onClick={() => openTab("Command")}>Open command center</button></div><div className="ev-concept-grid"><article><p className="eyebrow">Guide tier · Basic</p><h3>Protocols</h3><p>High-risk transit procedures and controlled reference material.</p></article><article><p className="eyebrow">Guide tier · Pro</p><h3>Emergency + Tracker</h3><p>Protocols plus emergency response, identity, live position, geofence, and case handling.</p></article><article><p className="eyebrow">Guide tier · Enterprise</p><h3>AI + Family Portal</h3><p>Expanded analytics, automated assistance, claims, family communication, and organizational governance.</p></article></div></section>
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">30-Day Rollout</p><h2>Training and operating measures</h2></div></div><div className="ev-numbered-list"><article><span>1</span><p>Configure official procedures, owners, locations, vessel records, contacts, and evidence requirements.</p></article><article><span>2</span><p>Train Masters, bridge teams, DPA, CSO, HR, welfare, legal, fleet, IT, security, and family-support administrators.</p></article><article><span>3</span><p>Measure drill completion %, response time, transit safety score, and crew welfare.</p></article><article><span>4</span><p>Review audit activity and unresolved incidents before expanding automation.</p></article></div><div className="actions"><button className="btn" onClick={() => openTab("Settings")}>Configure workspace</button><button className="btn" onClick={() => openTab("Activity")}>Review audit</button><button className="btn gold" onClick={() => openTab("Command")}>Review KPIs</button></div></section>
    </div>}

    <section className="ev-panel"><p className="eyebrow">Safe Hands Only</p><h2>For the Crew. For the Family. For the Company.</h2><p><b>No Other Master Leaves Anyone Behind.</b></p></section>
  </div>;
}
