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

let page = localStorage.getItem('neptune_page') || 'Dashboard';
let authed = localStorage.getItem('neptune_auth') === 'yes';
let sidebar = false;
let drawer = null;
let searchOpen = false;

function setPage(next){ page = next; sidebar = false; drawer = null; searchOpen = false; localStorage.setItem('neptune_page', page); render(); }
function openDrawer(title, body){ drawer = { title, body }; render(); }
function closeDrawer(){ drawer = null; render(); }
function toast(message){ const t=document.createElement('div'); t.className='toast'; t.textContent=message; document.body.appendChild(t); setTimeout(()=>t.remove(),1700); }

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
        <div class="login-row"><span><input type="checkbox" checked /> Remember workspace</span><a>Forgot password?</a></div>
        <button class="primary" type="submit">Enter Command Center →</button>
        <button class="secondary" type="button" data-toast="Access request captured">Request organization access</button>
      </form>
    </section>
    <button class="fab" data-quick="true">+</button>
  </main>`;
}

function shell(){
  const copy = pageCopy[page] || pageCopy.Dashboard;
  return `<div class="app-shell ${sidebar?'menu-active':''}">
    <aside class="sidebar">
      <div class="side-head"><div class="neptune-logo compact"><div class="logo-eye">✦</div><b>NEPTUNE</b></div><button class="icon-btn" data-menu="close">×</button></div>
      <div class="side-label">Vessel Command</div>
      <nav class="side-nav">${PAGES.map(p=>`<button class="side-link ${p===page?'active':''}" data-page="${p}"><span>${p}</span><em>Navigate</em></button>`).join('')}</nav>
    </aside>
    <button class="scrim" data-menu="close"></button>
    <main class="workspace">
      ${topbar()}
      ${searchOpen ? commandSearch() : ''}
      ${page === 'Dashboard' ? dashboard() : pageTemplate(copy)}
    </main>
    ${drawerHtml()}
    <button class="fab" data-quick="true">+</button>
    <nav class="bottom-dock"><button data-page="Dashboard">⌂</button><button data-page="Vessels">▱</button><button data-search="true">⌕</button><button data-page="Certificates">▣</button><button data-menu="open">☰</button></nav>
  </div>`;
}

function topbar(){
  return `<header class="topbar"><button class="icon-btn" data-menu="open">☰</button><button class="search-pill" data-search="true">⌘ Search vessels, crew, PTW, inventory, certificates... <kbd>Ctrl<br/>K</kbd></button><button class="bell" data-drawer="Notifications|4 urgent operating items require attention.">🔔<i></i></button></header>`;
}

function dashboard(){
  return `<section class="hero-card glass">
    <p class="eyebrow">Live Command Center</p>
    <h1>Every vessel, every approval, every risk signal — visible in one place.</h1>
    <p class="hero-copy">Neptune consolidates the bridge, engine room, safety office, inventory, documents, and shore operations into a premium maritime intelligence layer.</p>
    <div class="stack-metrics">${metric('6','Active vessels')}${metric('3','Pending approvals')}${metric('97%','Fleet health')}${metric('38h','Next ETA')}</div>
  </section>
  <section class="map-card glass"><div class="card-title"><h2>Fleet Position</h2><button data-page="Navigation">Open Navigation</button></div><div class="fleet-map"><span style="left:22%;top:38%">Atlantic Pioneer</span><span style="left:54%;top:25%">Pacific Meridian</span><span style="left:72%;top:56%">Aurora Spirit</span><span style="left:42%;top:70%">Northstar</span></div></section>
  <section class="split-grid"><div class="glass panel-block"><h2>Inventory Risk</h2>${barMetric('Below minimum stock','2')}${barMetric('Critical spares pending','19')}</div><div class="glass panel-block"><h2>Critical Queue</h2>${queueRows()}</div></section>
  <section class="glass panel-block"><div class="card-title"><h2>Recent Activity</h2><button data-toast="Activity refreshed">Refresh</button></div>${activity.map(a=>`<div class="activity"><b>${a[0]}</b><span>${a[1]}<small>${a[2]}</small></span></div>`).join('')}</section>`;
}

function pageTemplate(copy){
  return `<section class="page-head glass"><p class="eyebrow">${page}</p><h1>${copy[0]}</h1><p>${copy[1]}</p><div class="action-row"><button class="primary small" data-drawer="${copy[0]}|Operational detail drawer. This pattern keeps record intelligence consistent across every module.">Take Action</button><button data-toast="Export queued">Export</button><button data-toast="Comment panel opened">Comment</button></div></section>
  ${page === 'Cargo' ? cargoPanel() : ''}
  ${page === 'Port Calls' ? portPanel() : ''}
  ${page === 'Fleet Overview' ? fleetPanel() : ''}
  ${page === 'Vessel Profile' ? vesselProfilePanel() : ''}
  <section class="grid-cards">${moduleCards().map(c=>`<article class="glass module-card" data-drawer="${c[0]}|${c[2]}"><div class="module-icon">${c[3]}</div><h2>${c[0]}</h2><p>${c[1]}</p><span class="status">${c[4]}</span></article>`).join('')}</section>
  <section class="glass panel-block"><h2>Audit Trail</h2>${activity.map(a=>`<div class="activity"><b>${a[0]}</b><span>${a[1]}<small>${a[2]}</small></span></div>`).join('')}</section>`;
}

function metric(value,label){ return `<div class="metric"><b>${value}</b><span>${label}</span></div>`; }
function barMetric(label,value){ return `<div class="bar-metric"><b>${value}</b><span>${label}</span><div class="bars">${Array.from({length:10}).map((_,i)=>`<i style="height:${20+i*5}%"></i>`).join('')}</div></div>`; }
function queueRows(){ return [['PTW #0047','Hot-work permit entry needs Master signature','Critical'],['eORB #044','Engineering entry countersign pending','Attention'],['PO-291','Parts PO waiting vendor clean approval','Attention'],['Certificate IOPP','MV Pacific Meridian expires in 21 days','Attention']].map(q=>`<button class="queue" data-drawer="${q[0]}|${q[1]}"><b>${q[0]}</b><span>${q[1]}</span><em>${q[2]}</em></button>`).join(''); }

function moduleCards(){
  return [
    ['Signed PTW Register','Safety critical records and authorization history.','Permit package, validation, audit trail, and comments are connected.','▧','Current'],
    ['Vessel Certificates','ISM, IOPP, MLC, safe manning and audit packs.','Certificate status, alerts, and renewal evidence.','▰','Attention'],
    ['Port Package','MOC crew list, stores declaration, dangerous goods forms.','Agent-ready port package generated from vessel records.','⌁','Pending'],
    ['Maintenance Reports','PMS completion logs and machinery history.','Work order timeline with closeout evidence.','⚙','Current'],
    ['Crew Readiness','Certificates, rest hours, medicals, and watch cover.','Crew compliance and readiness board.','♙','Good'],
    ['Agent Links','All connected for port coordination.','Agent messages and port-call records.','⛓','100%']
  ];
}

function cargoPanel(){ return `<section class="glass panel-block"><h2>Cargo Units</h2>${barMetric('Manifest imported','342 TEU')}${barMetric('IMDG segregation valid','12 Hazmat')}${barMetric('All powered','84 Reefers')}<button class="primary small" data-toast="Stowage validation opened">Validate Stowage</button></section>`; }
function portPanel(){ return `<section class="glass panel-block"><div class="card-title"><h2>Port Call Board</h2><button class="primary small" data-toast="New port call opened">New Port Call</button></div><table><tbody>${[['Santos','MV Atlantic Pioneer','ETA +38h'],['Houston','MT Aurora Spirit','At anchor'],['Singapore','MV Pacific Meridian','ETA 4d']].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>${barMetric('Next 7 days','3')}${barMetric('Pending signature','11')}</section>`; }
function fleetPanel(){ return `<section class="grid-cards compact">${metricCard('Fleets','3','Atlantic, Gulf, Pacific')}${metricCard('Vessels','13','9 underway · 4 in port')}${metricCard('Utilization','88%','Below dry-dock operating limit')}${metricCard('Compliance','96%','Open items trending down')}</section>`; }
function vesselProfilePanel(){ return `<section class="glass panel-block"><div class="tabs"><button>Overview</button><button>Voyage</button><button>Crew</button><button>Risk</button><button>Documents</button></div>${barMetric('En Route · Santos ETA 38h','Voyage Status')}${barMetric('PTW · eORB · NOR','3 Pending Signatures')}${barMetric('2 tasks due','96% PMS Health')}</section>`; }
function metricCard(t,v,n){ return `<article class="glass module-card"><h2>${t}</h2><b class="big-number">${v}</b><p>${n}</p><div class="bars">${Array.from({length:10}).map((_,i)=>`<i style="height:${20+i*5}%"></i>`).join('')}</div></article>`; }

function commandSearch(){ return `<section class="search-panel glass"><input id="search-input" placeholder="Search vessels, modules, certificates, PTW, crew..." autofocus /><div class="search-results">${PAGES.map(p=>`<button data-page="${p}"><b>${p}</b><span>${pageCopy[p]?.[1] || 'Navigate'}</span></button>`).join('')}</div></section>`; }

function drawerHtml(){
  if(!drawer) return '';
  return `<div class="drawer-backdrop" data-close="true"></div><aside class="drawer glass"><button class="icon-btn close" data-close="true">×</button><p class="eyebrow">Operational Detail</p><h1>${drawer.title}</h1><p>${drawer.body}</p><div class="form-grid"><label>Primary<input value="${page}" /></label><label>Field 1<input value="Captain" /></label><label>Field 2<input value="PTW #0047" /></label><label>Field 3<input value="Critical" /></label></div><div class="action-row"><button class="primary small" data-toast="Action taken">Take Action</button><button data-toast="Export queued">Export</button><button data-toast="Comment added">Comment</button></div><section class="audit"><h2>Audit Trail</h2>${activity.slice(0,2).map(a=>`<div class="activity"><b>${a[0]}</b><span>${a[1]}<small>${a[2]}</small></span></div>`).join('')}</section></aside>`;
}

function quickCreate(){ openDrawer('New Record', 'Create a new PTW, work order, port call, certificate action, incident, or procurement request.'); }

function render(){ document.getElementById('app').innerHTML = authed ? shell() : loginScreen(); }

document.addEventListener('click', e=>{
  const target = e.target.closest('button,.side-link,.module-card,.scrim,.drawer-backdrop');
  if(!target) return;
  if(target.dataset.page) return setPage(target.dataset.page);
  if(target.dataset.menu === 'open'){ sidebar = true; return render(); }
  if(target.dataset.menu === 'close'){ sidebar = false; return render(); }
  if(target.dataset.close) return closeDrawer();
  if(target.dataset.search){ searchOpen = !searchOpen; return render(); }
  if(target.dataset.quick) return quickCreate();
  if(target.dataset.toast) return toast(target.dataset.toast);
  if(target.dataset.drawer){ const [title, body] = target.dataset.drawer.split('|'); return openDrawer(title, body); }
});

document.addEventListener('submit', e=>{
  if(e.target.id === 'login-form'){ e.preventDefault(); authed = true; localStorage.setItem('neptune_auth','yes'); render(); }
});

window.addEventListener('keydown', e=>{ if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); searchOpen = true; render(); } if(e.key==='Escape'){ sidebar=false; drawer=null; searchOpen=false; render(); }});

render();
