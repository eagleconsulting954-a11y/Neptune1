const groups = {
  Command: ["Dashboard", "Fleet", "Vessels", "Voyages"],
  Operations: ["Navigation", "Cargo", "Port Calls"],
  Crew: ["Crew List", "Crew Certificates", "Watch Schedule"],
  Maintenance: ["PMS", "Work Orders", "Machinery"],
  Safety: ["Permit to Work", "Inspections", "Incidents"],
  Compliance: ["eORB", "ISM", "PSC Readiness", "Certificates"],
  Inventory: ["Inventory", "Purchase Orders", "Vendors"],
  Workspace: ["Documents", "Analytics", "Neptune AI", "Administration"]
};

const detail = {
  Dashboard: ["Fleet Command Center", "Live fleet health, alerts, approvals, port calls, and executive risk."],
  Fleet: ["Fleet Overview", "Portfolio readiness, utilization, vessel status, and off-hire risk."],
  Vessels: ["Vessels", "Operational profiles, voyage state, defects, and readiness scores."],
  Voyages: ["Voyages", "ETAs, routing, weather, port-call timelines, and voyage milestones."],
  Navigation: ["Navigation", "Bridge workflow, ECDIS updates, route amendments, and weather risk."],
  Cargo: ["Cargo", "Stowage, dangerous goods checks, stability, and terminal handoff."],
  "Port Calls": ["Port Calls", "Arrival packages, agents, NOR, SOF, customs, and readiness."],
  "Crew List": ["Crew List", "Crew assignments, contracts, travel, medicals, and onboard status."],
  "Crew Certificates": ["Crew Certificates", "STCW, medical, endorsements, and qualification exceptions."],
  "Watch Schedule": ["Watch Schedule", "Bridge and engine watch planning with rest-hour compliance."],
  PMS: ["Planned Maintenance System", "Sprint 3: due tasks, running-hour triggers, overdue items, and asset risk."],
  "Work Orders": ["Work Orders", "Sprint 3: corrective and preventive work orders, owners, closeout, and audit trail."],
  Machinery: ["Machinery", "Sprint 3: running hours, condition monitoring, alarms, and defects."],
  "Permit to Work": ["Permit to Work", "Sprint 4: high-risk work authorization with checklist enforcement and Master signature."],
  Inspections: ["Inspections", "Sprint 4: safety rounds, MLC, ISM, PSC pre-arrival, and evidence capture."],
  Incidents: ["Incidents", "Sprint 4: near misses, RCA, corrective actions, and severity tracking."],
  eORB: ["Electronic Oil Record Book", "Sprint 4: MARPOL oil record entries, validation, lock, and countersignature."],
  ISM: ["ISM Management", "Safety management system, audits, nonconformities, corrective actions."],
  "PSC Readiness": ["PSC Readiness", "Port state control readiness scoring, evidence packs, and action plans."],
  Certificates: ["Vessel Certificates", "Statutory, class, insurance, and safety certificate intelligence."],
  Inventory: ["Inventory", "Sprint 3: critical spares, min/max stock, reservations, and auto-reorder."],
  "Purchase Orders": ["Purchase Orders", "Sprint 3: requisitions, approvals, vendors, delivery, and receiving."],
  Vendors: ["Vendors", "Sprint 3: approved suppliers, chandlers, service partners, and performance."],
  Documents: ["Documents", "Document vault, versions, signatures, AI extraction, and evidence packs."],
  Analytics: ["Executive Analytics", "Sprint 4: operational KPIs, readiness, cost, compliance, and trends."],
  "Neptune AI": ["Neptune AI", "Sprint 4: operational copilot for summaries, actions, and risk detection."],
  Administration: ["Administration", "Users, roles, permissions, integrations, notifications, and audit logs."]
};

const rows = ["Atlantic Pioneer", "Neptune Trader", "Meridian Star", "Pacific Crown"].map((v, i) => [v, ["En route", "In port", "PSC watch", "Cargo ops"][i], ["94%", "88%", "82%", "91%"][i], ["Review", "Open", "Escalate", "Approve"][i]]);
const allPages = Object.values(groups).flat();
let page = "Dashboard";
let drawer = null;
let menuOpen = false;

function slug(x) { return x.replaceAll(" ", "-").toLowerCase(); }
function pageFromHash() { const found = allPages.find(x => slug(x) === location.hash.slice(1)); if (found) page = found; }
function selectPage(name) { page = name; drawer = null; menuOpen = false; history.replaceState(null, "", `#${slug(name)}`); render(); }
function openDrawer(title, body) { drawer = { title, body }; render(); }
function closeDrawer() { drawer = null; render(); }
function toast(message) { const e = document.createElement("div"); e.className = "toast"; e.textContent = message; document.body.appendChild(e); setTimeout(() => e.remove(), 1800); }

function nav() {
  return Object.entries(groups).map(([group, items]) => `
    <section class="nav-group">
      <div class="nav-heading">${group}</div>
      ${items.map(item => `<button type="button" class="nav ${page === item ? "active" : ""}" data-page="${item}"><span>${item}</span><small>${detail[item][1]}</small></button>`).join("")}
    </section>`).join("");
}

function kpis() {
  return [["Fleet Health", "92%", "+4% this week", "good"], ["Critical Alerts", "4", "2 safety critical", "bad"], ["Pending Approvals", "18", "PTW, eORB, PO", "warn"], ["Readiness Score", "A-", "Executive grade", "info"]]
    .map(([name, value, note, cls]) => `<article class="kpi ${cls}"><span>${name}</span><b>${value}</b><p>${note}</p></article>`).join("");
}

function table() {
  return `<div class="panel"><div class="head"><div><h2>${page} Work Queue</h2><p>Prototype records with drawers, search, notifications, and quick actions.</p></div><button type="button" data-drawer="Filters|Saved views, bulk actions, export, and audit history are wired for prototype review.">Controls</button></div><div class="table"><table><thead><tr><th>Record</th><th>Status</th><th>Readiness</th><th>Action</th></tr></thead><tbody>${rows.map(row => `<tr data-drawer="${row[0]}|Module: ${page}<br>Status: ${row[1]}<br>Readiness: ${row[2]}<br><br>Available actions: assign owner, approve, comment, attach evidence, export, and view audit history.">${row.map((cell, i) => `<td>${i === 3 ? `<span class="chip">${cell}</span>` : cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
}

function side() {
  const alerts = [["Safety critical", "PTW #0047 awaiting Master signature", "bad"], ["Procurement", "19 work orders waiting on parts", "warn"], ["AI suggestion", "Summarize elevated-risk vessels", "info"], ["Readiness gain", "Compliance score improved 4%", "good"]];
  return `<aside class="panel pulse"><h2>Operational Pulse</h2>${alerts.map(([a, b, c]) => `<button type="button" class="alert ${c}" data-drawer="${a}|${b}"><b>${a}</b><span>${b}</span></button>`).join("")}</aside>`;
}

function drawerHtml() {
  if (!drawer) return "";
  return `<div class="shade" data-close="true"></div><aside class="drawer"><button type="button" class="x" data-close="true">×</button><p class="eyebrow">Detail Panel</p><h2>${drawer.title}</h2><div class="body">${drawer.body}</div><div class="actions"><button type="button" data-close="true">Close</button><button type="button" class="gold" data-toast="Action saved">Save action</button></div></aside>`;
}

function render() {
  pageFromHash();
  const d = detail[page] || detail.Dashboard;
  document.getElementById("app").innerHTML = `<aside class="sidebar ${menuOpen ? "open" : ""}"><div class="brand"><div class="mark">◈</div><div><b>NEPTUNE</b><span>Maritime Intelligence</span></div><button type="button" class="hamb close-menu" data-menu="close">×</button></div><button type="button" class="new" data-quick="true">＋ New Workflow</button><div class="nav-scroll">${nav()}</div></aside><div class="scrim ${menuOpen ? "show" : ""}" data-menu="close"></div><main><header><button type="button" class="hamb" data-menu="open">☰</button><div><small>Neptune / Live Ops</small><strong>${d[0]}</strong></div><button type="button" class="search" data-search="true">⌘K Search vessels, docs, PTWs, POs...</button><button type="button" class="icon" data-notify="true">🔔<em>4</em></button><button type="button" class="avatar">FE</button></header><section class="hero"><div><p class="eyebrow">Premium MVP</p><h1>${d[0]}</h1><p>${d[1]}</p></div><div><button type="button" data-search="true">Search</button><button type="button" class="gold" data-quick="true">Create</button></div></section><section class="kpis">${kpis()}</section><section class="grid">${table()}${side()}</section></main>${drawerHtml()}`;
}

document.addEventListener("click", event => {
  const target = event.target.closest("button,tr,.scrim,.shade");
  if (!target) return;
  const pageName = target.getAttribute("data-page");
  if (pageName) return selectPage(pageName);
  if (target.dataset.menu === "open") { menuOpen = true; return render(); }
  if (target.dataset.menu === "close") { menuOpen = false; return render(); }
  if (target.dataset.close) return closeDrawer();
  if (target.dataset.quick) return openDrawer("Quick Create", ["New PTW", "New Work Order", "New Purchase Order", "New Inspection", "Upload Document", "Create Incident", "Ask Neptune AI"].map(x => `<button type="button" class="quick" data-toast="${x} started">${x}</button>`).join(""));
  if (target.dataset.notify) return openDrawer("Notifications", "<b>4 items need attention.</b><br><br>PTW authorization, eORB countersign, PO approval, and PSC evidence upload.");
  if (target.dataset.search) return openDrawer("Command Search", allPages.map(x => `<button type="button" class="result" data-page="${x}"><b>${x}</b><span>${detail[x][1]}</span></button>`).join(""));
  if (target.dataset.drawer) { const [title, body] = target.dataset.drawer.split("|"); return openDrawer(title, body); }
  if (target.dataset.toast) return toast(target.dataset.toast);
});

window.addEventListener("hashchange", () => { pageFromHash(); render(); });
render();
