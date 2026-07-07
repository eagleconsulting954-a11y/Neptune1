const PAGES = [
  'Dashboard','Fleet Overview','Vessels','Vessel Profile','Voyages','Navigation','Cargo','Port Calls','Crew List','Crew Certificates','Watch Schedule','PMS','Work Orders','Machinery','PTW Register','Inspections','Incidents','eORB','Inventory','Critical Quotes','Certificates','Agent Desk','Analytics','Settings'
];

const pageCopy = {
  Dashboard: ['Live Command Center', 'Every vessel, every approval, every risk signal — visible in one place.', 'Neptune consolidates the bridge, engine room, safety office, inventory, documents, and shore operations into a premium maritime intelligence layer.'],
  'Fleet Overview': ['Fleet Overview', 'Company-wide operating view with fleet status, utilization, risk, and compliance health.'],
  Vessels: ['Vessels', 'All vessel records, operating status, department ownership, and open actions.'],
  'Vessel Profile': ['Vessel Profile', 'Single vessel command record with certificates, defects, approvals, documents, and activity.'],
  Voyages: ['Voyages', 'Active voyages, ETAs, routing, weather exposure, and port-call windows.'],
  Navigation: ['Navigation', 'Route monitoring, bridge updates, ECDIS status, notices, and navigation risk.'],
  Cargo: ['Cargo Operations', 'Cargo manifest validation, IMDG checks, reefer status, stowage, and stability workflows.'],
  'Port Calls': ['Port Calls', 'Port agency coordination, ETA windows, port documents, and readiness tracking.'],
  'Crew List': ['Crew List', 'Crew assignments, certificates, medicals, travel, watch schedules, and rest-hour exceptions.'],
  'Crew Certificates': ['Crew Certificates', 'STCW, medical, endorsements, training, and renewal intelligence.'],
  'Watch Schedule': ['Watch Schedule', 'Bridge and engine watch planning with rest-hour visibility.'],
  PMS: ['Planned Maintenance', 'Running-hour triggers, due tasks, overdue work, critical machinery, and defects.'],
  'Work Orders': ['Work Orders', 'Corrective and preventive maintenance, owners, closeout evidence, and audit history.'],
  Machinery: ['Machinery', 'Main engine, auxiliaries, pumps, alarms, and condition snapshots.'],
  'PTW Register': ['Signed PTW Register', 'Safety-critical records and authorization history.'],
  Inspections: ['Inspections', 'Safety rounds, PSC checks, MLC, internal inspections, and evidence capture.'],
  Incidents: ['Incidents', 'Near misses, incidents, root cause analysis, corrective actions, and severity tracking.'],
  eORB: ['Electronic Oil Record Book', 'MARPOL oil record entries, validation, locks, and countersignatures.'],
  Inventory: ['Inventory Risk', 'Critical spares, stock thresholds, reorders, reservations, and vendor linkage.'],
  'Critical Quotes': ['Critical Quotes', 'Open RFQs, vendor responses, approvals, and procurement risk.'],
  Certificates: ['Vessel Certificates', 'ISM, IOPP, MLC, safe manning, class, insurance, and renewal packs.'],
  'Agent Desk': ['Agent Desk', 'Port agents, documents, port-call messages, ETA windows, and local requirements.'],
  Analytics: ['Executive Analytics', 'Fleet KPIs, operational scorecards, costs, compliance, and risk trends.'],
  Settings: ['Settings', 'Workspace users, roles, notifications, integrations, and audit controls.']
};

const vesselRows = [
  ['Atlantic Pioneer','Captain','PSC readiness review','ETA +38h','Critical'],
  ['MT Aurora Spirit','Engineering','Aux generator work order','At anchor','Attention'],
  ['MV Pacific Meridian','Deck','Hot work permit approval','ETA 4d','Pending'],
  ['Northstar','Procurement','Critical spares reorder','Vendor quote','Current']
];

const activity = [
  ['14:11','Chief Mate submitted PTW #0047','Awaiting Master signature now.'],
  ['13:45','System validation complete','No blocking errors in certificate pack.'],
  ['11:20','Procurement quote updated','Vendor matched 19 urgent items.'],
  ['09:05','eORB entry locked','Chief Engineer countersignature recorded.']
];

const popupData = {
  notifications: {
    title: 'Notifications',
    body: '<b>4 urgent operating items require attention.</b><br><br>• PTW #0047 needs Master signature before hot work can begin.<br>• eORB #044 requires Chief Engineer countersignature.<br>• PO-291 is waiting for vendor quote approval.<br>• IOPP certificate expires in 21 days for MV Pacific Meridian.',
    fields: [['Queue owner','Captain'],['Highest severity','Critical'],['Due window','Today'],['Escalation','Enabled']]
  },
  profile: {
    title: 'Operator Profile',
    body: 'Francis is logged into the demo workspace as the fleet administrator. This panel will hold account settings, role permissions, vessel access, MFA status, and audit preferences.',
    fields: [['Role','Fleet Admin'],['Workspace','Neptune Demo'],['Access','All vessels'],['MFA','Planned']]
  },
  quick: {
    title: 'Quick Create',
    body: 'Start a new operating record. These buttons simulate creating records that would save into the real Neptune database.',
    quick: ['New PTW','New Work Order','New Port Call','New Certificate Action','New Incident','New Purchase Request','Upload Evidence','New Crew Note']
  },
  export: {
    title: 'Export Package',
    body: 'Export will generate a signed PDF/CSV evidence package for the current module, including timestamps, owners, attached documents, and approval history.',
    fields: [['Format','PDF + CSV'],['Module','Current page'],['Audit trail','Included'],['Delivery','Email + download']]
  },
  comment: {
    title: 'Comment Thread',
    body: 'Comments stay connected to the vessel, module, and record. Mentions will notify the Captain, Chief Engineer, Chief Officer, shore manager, or procurement owner.',
    fields: [['Thread','Operational review'],['Participants','Captain, HOD, Shore'],['Status','Open'],['Visibility','Internal']]
  },
  refresh: {
    title: 'Activity Refreshed',
    body: 'The activity stream has been refreshed. In production this would pull the latest vessel events, document updates, approvals, and department comments.',
    fields: [['Last sync','Just now'],['New events','4'],['Source','Fleet workspace'],['Status','Healthy']]
  },
  access: {
    title: 'Organization Access Request',
    body: 'Access request captured. In the real product this would send a request to the workspace administrator and create an onboarding task.',
    fields: [['Requester','francis@neptune.local'],['Workspace','Neptune Demo'],['Role requested','Admin'],['Status','Pending']]
  },
  forgot: {
    title: 'Password Recovery',
    body: 'Password recovery would email a secure link and record the event in the workspace security log.',
    fields: [['Email','francis@neptune.local'],['Method','Secure email link'],['Expires','15 minutes'],['Audit','Recorded']]
  }
};

let page = localStorage.getItem('neptune_page') || 'Dashboard';
let authed = localStorage.getItem('neptune_auth') === 'yes';
let sidebar = false;
let drawer = null;
let searchOpen = false;

function setPage(next){ page = next; sidebar = false; drawer = null; searchOpen = false; localStorage.setItem('neptune_page', page); render(); }
function openDrawer(title, body, fields = null, quick = null){ drawer = { title, body, fields, quick }; searchOpen = false; render(); }
function openPopup(key){ const item = popupData[key]; if(item) openDrawer(item.title, item.body, item.fields, item.quick); }
function closeDrawer(){ drawer = null; render(); }
function toast(message){ const t=document.createElement('div'); t.className='toast'; t.textContent=message; document.body.appendChild(t); setTimeout(()=>t.remove(),1700); }
function safe(value){ return String(value).replaceAll('"','&quot;'); }

function loginScreen(){
  return `<main class="login-wrap">
    <section class="login-card">
      <div class="neptune-logo"><div class="logo-eye">✦</div><b>NEPTUNE</b></div>
      <p class="eyebrow">Secure Operator Login</p>
      <h1>Welcome to Neptune</h1>
      <p class="muted big">Use the demo credentials below to enter the clickable prototype.</p>
      <form id="login-form" class="login-form">
        <label>Email<input value="francis@neptune.local" autocomplete="email" /></label>
        <label>Password<input value="neptune" type="password" autocomplete="current-password" /></label>
        <div class="login-row"><span><input type="checkbox" checked /> Remember workspace</span><button type="button" class="text-button" data-popup="forgot">Forgot password?</button></div>
        <button class="primary" type="submit">Enter Command Center →</button>
        <button class="secondary" type="button" data-popup="access">Request organization access</button>
      </form>
    </section>
    <button class="fab" data-popup="quick" aria-label="Quick create">+</button>
  </main>`;
}

function shell(){
  const copy = pageCopy[page] || pageCopy.Dashboard;
  return `<div class="app-shell ${sidebar?'menu-active':''}">
    <aside class="sidebar" aria-label="Neptune navigation">
      <div class="side-head"><div class="neptune-logo compact"><div class="logo-eye">✦</div><b>NEPTUNE</b></div><button class="icon-btn" data-menu="close" aria-label="Close menu">×</button></div>
      <div class="side-label">Vessel Command</div>
      <nav class="side-nav">${PAGES.map(p=>`<button class="side-link ${p===page?'active':''}" data-page="${p}"><span>${p}</span><em>${pageCopy[p]?.[0] || 'Navigate'}</em></button>`).join('')}</nav>
    </aside>
    <button class="scrim" data-menu="close" aria-label="Close menu"></button>
    <main class="workspace">
      ${topbar()}
      ${searchOpen ? commandSearch() : ''}
      ${page === 'Dashboard' ? dashboard() : pageTemplate(copy)}
    </main>
    ${drawerHtml()}
    <button class="fab" data-popup="quick" aria-label="Quick create">+</button>
    <nav class="bottom-dock" aria-label="Mobile navigation"><button data-page="Dashboard" aria-label="Dashboard">⌂</button><button data-page="Vessels" aria-label="Vessels">▱</button><button data-search="true" aria-label="Search">⌕</button><button data-page="Certificates" aria-label="Certificates">▣</button><button data-menu="open" aria-label="Menu">☰</button></nav>
  </div>`;
}

function topbar(){
  return `<header class="topbar"><button class="icon-btn" data-menu="open" aria-label="Open menu">☰</button><button class="search-pill" data-search="true">⌘ Search vessels, crew, PTW, inventory, certificates... <kbd>Ctrl<br/>K</kbd></button><button class="bell" data-popup="notifications" aria-label="Notifications">🔔<i></i></button><button class="profile-pill" data-popup="profile">FE</button></header>`;
}

function dashboard(){
  return `<section class="hero-card glass" data-drawer="Live Command Center|Neptune is combining vessel records, department workflows, approvals, and evidence into one operating layer.">
    <p class="eyebrow">Live Command Center</p>
    <h1>Every vessel, every approval, every risk signal — visible in one place.</h1>
    <p class="hero-copy">Neptune consolidates the bridge, engine room, safety office, inventory, documents, and shore operations into a premium maritime intelligence layer.</p>
    <div class="stack-metrics">${metric('6','Active vessels','Six vessels are active across Atlantic, Gulf, and Pacific fleets.')} ${metric('3','Pending approvals','Captain approval is required on PTW, eORB, and purchase order records.')} ${metric('97%','Fleet health','Fleet health combines compliance, PMS, safety, certificates, and port-call readiness.')} ${metric('38h','Next ETA','Atlantic Pioneer arrives Santos in approximately 38 hours.')}</div>
  </section>
  <section class="map-card glass"><div class="card-title"><h2>Fleet Position</h2><button data-page="Navigation">Open Navigation</button></div><div class="fleet-map"><button class="map-pin" style="left:22%;top:38%" data-drawer="Atlantic Pioneer|ETA Santos +38h. PSC readiness review is critical and certificate pack is prepared.">Atlantic Pioneer</button><button class="map-pin" style="left:54%;top:25%" data-drawer="Pacific Meridian|ETA Singapore 4 days. Deck department has hot work permit awaiting Master signature.">Pacific Meridian</button><button class="map-pin" style="left:72%;top:56%" data-drawer="Aurora Spirit|At anchor. Engineering department has auxiliary generator work order waiting on parts.">Aurora Spirit</button><button class="map-pin" style="left:42%;top:70%" data-drawer="Northstar|Procurement queue has critical spares reorder and vendor quote pending.">Northstar</button></div></section>
  <section class="split-grid"><div class="glass panel-block"><h2>Inventory Risk</h2>${barMetric('Below minimum stock','2','Two critical spares are below minimum stock. Create reorder or assign buyer.')} ${barMetric('Critical spares pending','19','Nineteen critical spare line items are waiting on vendor response or approval.')}</div><div class="glass panel-block"><h2>Critical Queue</h2>${queueRows()}</div></section>
  <section class="glass panel-block"><div class="card-title"><h2>Recent Activity</h2><button data-popup="refresh">Refresh</button></div>${activity.map(a=>`<button class="activity" data-drawer="${safe(a[1])}|${safe(a[2])}"><b>${a[0]}</b><span>${a[1]}<small>${a[2]}</small></span></button>`).join('')}</section>`;
}

function pageTemplate(copy){
  return `<section class="page-head glass"><p class="eyebrow">${page}</p><h1>${copy[0]}</h1><p>${copy[1]}</p><div class="action-row"><button class="primary small" data-drawer="${safe(copy[0])}|Open operational action center for ${safe(page)}. Assign an owner, attach evidence, set due dates, and record approvals.">Take Action</button><button data-popup="export">Export</button><button data-popup="comment">Comment</button></div></section>
  ${page === 'Cargo' ? cargoPanel() : ''}
  ${page === 'Port Calls' ? portPanel() : ''}
  ${page === 'Fleet Overview' ? fleetPanel() : ''}
  ${page === 'Vessel Profile' ? vesselProfilePanel() : ''}
  <section class="grid-cards">${moduleCards().map(c=>`<article class="glass module-card" data-drawer="${safe(c[0])}|${safe(c[2])}"><div class="module-icon">${c[3]}</div><h2>${c[0]}</h2><p>${c[1]}</p><span class="status">${c[4]}</span></article>`).join('')}</section>
  <section class="glass panel-block"><h2>Audit Trail</h2>${activity.map(a=>`<button class="activity" data-drawer="${safe(a[1])}|${safe(a[2])}"><b>${a[0]}</b><span>${a[1]}<small>${a[2]}</small></span></button>`).join('')}</section>`;
}

function metric(value,label,body){ return `<button class="metric" data-drawer="${safe(label)}|${safe(body)}"><b>${value}</b><span>${label}</span></button>`; }
function barMetric(label,value,body){ return `<button class="bar-metric" data-drawer="${safe(label)}|${safe(body)}"><b>${value}</b><span>${label}</span><div class="bars">${Array.from({length:10}).map((_,i)=>`<i style="height:${20+i*5}%"></i>`).join('')}</div></button>`; }
function queueRows(){ return [['PTW #0047','Hot-work permit entry needs Master signature','Critical'],['eORB #044','Engineering entry countersign pending','Attention'],['PO-291','Parts PO waiting vendor quote approval','Attention'],['Certificate IOPP','MV Pacific Meridian expires in 21 days','Attention']].map(q=>`<button class="queue" data-drawer="${q[0]}|${q[1]}. Owner, deadline, evidence attachments, and escalation path are ready in this record."><b>${q[0]}</b><span>${q[1]}</span><em>${q[2]}</em></button>`).join(''); }

function moduleCards(){
  return [
    ['Signed PTW Register','Safety critical records and authorization history.','Permit package, validation, audit trail, and comments are connected. Master and Chief Officer signoff states are visible.','▧','Current'],
    ['Vessel Certificates','ISM, IOPP, MLC, safe manning and audit packs.','Certificate status, renewal dates, owners, alerts, and attached evidence are connected to the vessel record.','▰','Attention'],
    ['Port Package','MOC crew list, stores declaration, dangerous goods forms.','Agent-ready port package generated from vessel records, cargo data, crew data, and document vault.','⌁','Pending'],
    ['Maintenance Reports','PMS completion logs and machinery history.','Work order timeline with closeout evidence, running-hour triggers, defects, and parts reservations.','⚙','Current'],
    ['Crew Readiness','Certificates, rest hours, medicals, and watch cover.','Crew compliance and readiness board with STCW, medical, watch, and travel exceptions.','♙','Good'],
    ['Agent Links','All connected for port coordination.','Agent messages, local requirements, port-call records, attachments, and pending requests are centralized.','⛓','100%']
  ];
}

function cargoPanel(){ return `<section class="glass panel-block"><h2>Cargo Units</h2>${barMetric('Manifest imported','342 TEU','Manifest data imported successfully from the cargo file.')} ${barMetric('IMDG segregation valid','12 Hazmat','Hazardous cargo has passed the current segregation checks.')} ${barMetric('Reefers powered','84 Reefers','All reefer units are powered and visible to the deck team.')}<button class="primary small" data-drawer="Stowage Validation|Open stowage validation workflow with IMDG checks, reefer list, dangerous goods, and terminal readiness.">Validate Stowage</button></section>`; }
function portPanel(){ return `<section class="glass panel-block"><div class="card-title"><h2>Port Call Board</h2><button class="primary small" data-drawer="New Port Call|Create a port call with agent, ETA, NOR, SOF, cargo documents, crew changes, and customs requirements.">New Port Call</button></div><table><tbody>${[['Santos','MV Atlantic Pioneer','ETA +38h'],['Houston','MT Aurora Spirit','At anchor'],['Singapore','MV Pacific Meridian','ETA 4d']].map(r=>`<tr data-drawer="${r[0]} Port Call|${r[1]} is ${r[2]}. Port-call documents, agent contact, and readiness checklist are available."><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>${barMetric('Next 7 days','3','Three port calls are scheduled over the next seven days.')} ${barMetric('Pending signature','11','Eleven port-call documents still need signature or review.')}</section>`; }
function fleetPanel(){ return `<section class="grid-cards compact">${metricCard('Fleets','3','Atlantic, Gulf, Pacific','Fleet groups, permissions, and executive rollups.')} ${metricCard('Vessels','13','9 underway · 4 in port','Fleet list with operating status and owners.')} ${metricCard('Utilization','88%','Below dry-dock operating limit','Utilization trend by vessel and operating region.')} ${metricCard('Compliance','96%','Open items trending down','Compliance score from certificates, audits, PSC, and documents.')}</section>`; }
function vesselProfilePanel(){ return `<section class="glass panel-block"><div class="tabs"><button data-drawer="Overview Tab|Shows vessel identity, status, owner, port-call state, and current readiness.">Overview</button><button data-drawer="Voyage Tab|Shows active voyage, ETA, weather, route, cargo, and port-call timeline.">Voyage</button><button data-drawer="Crew Tab|Shows onboard crew, certificates, rest hours, medicals, and watch cover.">Crew</button><button data-drawer="Risk Tab|Shows PSC, PMS, certificate, safety, and procurement risk signals.">Risk</button><button data-drawer="Documents Tab|Shows certificates, forms, photos, checklists, and evidence packs.">Documents</button></div>${barMetric('En Route · Santos ETA 38h','Voyage Status','The vessel is en route to Santos with a 38 hour ETA.')} ${barMetric('PTW · eORB · NOR','3 Pending Signatures','Three signatures are currently waiting for Captain or HOD action.')} ${barMetric('2 tasks due','96% PMS Health','Two maintenance tasks are due and PMS health remains strong.')}</section>`; }
function metricCard(t,v,n,body){ return `<article class="glass module-card" data-drawer="${safe(t)}|${safe(body)}"><h2>${t}</h2><b class="big-number">${v}</b><p>${n}</p><div class="bars">${Array.from({length:10}).map((_,i)=>`<i style="height:${20+i*5}%"></i>`).join('')}</div></article>`; }

function commandSearch(){ return `<section class="search-panel glass"><input id="search-input" placeholder="Search vessels, modules, certificates, PTW, crew..." autofocus /><div class="search-results">${PAGES.map(p=>`<button data-page="${p}"><b>${p}</b><span>${pageCopy[p]?.[1] || 'Navigate'}</span></button>`).join('')}</div></section>`; }

function drawerHtml(){
  if(!drawer) return '';
  const fields = drawer.fields || [['Module',page],['Owner','Captain'],['Record','PTW #0047'],['Priority','Critical']];
  const fieldHtml = fields.map(([label,value])=>`<label>${label}<input value="${safe(value)}" /></label>`).join('');
  const quickHtml = drawer.quick ? `<div class="quick-grid">${drawer.quick.map(item=>`<button data-drawer="${safe(item)}|${safe(item)} workflow opened. In production this creates a record, assigns an owner, and starts an audit trail.">${item}</button>`).join('')}</div>` : '';
  return `<div class="drawer-backdrop" data-close="true"></div><aside class="drawer glass"><button class="icon-btn close" data-close="true">×</button><p class="eyebrow">Operational Detail</p><h1>${drawer.title}</h1><p>${drawer.body}</p>${quickHtml}<div class="form-grid">${fieldHtml}</div><div class="action-row"><button class="primary small" data-toast="Action saved">Save Action</button><button data-popup="export">Export</button><button data-popup="comment">Comment</button><button data-toast="Evidence attachment queued">Attach Evidence</button></div><section class="audit"><h2>Audit Trail</h2>${activity.slice(0,2).map(a=>`<button class="activity" data-drawer="${safe(a[1])}|${safe(a[2])}"><b>${a[0]}</b><span>${a[1]}<small>${a[2]}</small></span></button>`).join('')}</section></aside>`;
}

function render(){ document.getElementById('app').innerHTML = authed ? shell() : loginScreen(); }

document.addEventListener('click', e=>{
  const target = e.target.closest('button,[data-page],[data-popup],[data-drawer],.side-link,.module-card,.scrim,.drawer-backdrop,.activity,.map-pin,.bar-metric,tr');
  if(!target) return;
  if(target.dataset.page) return setPage(target.dataset.page);
  if(target.dataset.popup) return openPopup(target.dataset.popup);
  if(target.dataset.menu === 'open'){ sidebar = true; return render(); }
  if(target.dataset.menu === 'close'){ sidebar = false; return render(); }
  if(target.dataset.close) return closeDrawer();
  if(target.dataset.search){ searchOpen = !searchOpen; drawer = null; sidebar = false; return render(); }
  if(target.dataset.toast) return toast(target.dataset.toast);
  if(target.dataset.drawer){ const split = target.dataset.drawer.split('|'); return openDrawer(split[0], split.slice(1).join('|') || 'Operational detail opened.'); }
});

document.addEventListener('submit', e=>{
  if(e.target.id === 'login-form'){ e.preventDefault(); authed = true; localStorage.setItem('neptune_auth','yes'); render(); }
});

window.addEventListener('keydown', e=>{ if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); searchOpen = true; drawer = null; render(); } if(e.key==='Escape'){ sidebar=false; drawer=null; searchOpen=false; render(); }});

render();
