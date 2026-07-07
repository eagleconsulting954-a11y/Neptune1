const app = document.querySelector('#app');

const storageKey = 'neptune-mvp-state-v1';

const seedState = {
  activePage: 'command-center',
  sidebarCollapsed: false,
  query: '',
  statusFilter: 'All',
  queue: [
    { id: 'NF-1042', vessel: 'MV Atlantic Vale', route: 'Panama Canal', due: '8h 24m', risk: 'High', status: 'Needs review', owner: 'Ops Lead' },
    { id: 'NF-1043', vessel: 'Sea Meridian', route: 'Suez Canal', due: '14h 10m', risk: 'Medium', status: 'Ready to file', owner: 'Compliance' },
    { id: 'NF-1044', vessel: 'Orion Star', route: 'Bosporus', due: '1d 4h', risk: 'Low', status: 'Submitted', owner: 'Agent Desk' },
  ],
  tasks: [
    { id: 1, text: 'Validate crew manifest mismatch for MV Atlantic Vale', done: false },
    { id: 2, text: 'Send Suez hazardous cargo exception packet', done: false },
    { id: 3, text: 'Review sprint 4 portal permission matrix', done: true },
  ],
  notifications: true,
};

const state = { ...seedState, ...safeParse(localStorage.getItem(storageKey)) };

const navGroups = [
  {
    label: 'Operations',
    items: [
      ['command-center', 'Command Center', '⌘'],
      ['voyages', 'Voyages', '◌'],
      ['vessels', 'Vessels', '▰'],
      ['clients', 'Clients', '◇'],
    ],
  },
  {
    label: 'Compliance',
    items: [
      ['compliance', 'Deadline Board', '✓'],
      ['filing-builder', 'Filing Builder', '✦'],
      ['documents', 'Document Vault', '▣'],
      ['audit', 'Audit Trail', '◷'],
    ],
  },
  {
    label: 'Growth',
    items: [
      ['analytics', 'Analytics', '↗'],
      ['automation', 'Automation', '⚡'],
      ['settings', 'Settings', '⚙'],
    ],
  },
];

const metrics = [
  ['Active Transits', '42', '+12%', 'Across 7 waterways'],
  ['Filing SLA', '97.8%', '+4.1%', 'On-time submission rate'],
  ['At-Risk Deadlines', '6', '-18%', 'Needs intervention'],
  ['Agent Hours Saved', '128', '+31%', 'This month'],
];

const voyageRows = [
  ['MV Atlantic Vale', 'Panama Canal', 'Balboa → Colón', '96h pre-arrival', 'High', 'Needs review'],
  ['Sea Meridian', 'Suez Canal', 'Port Said → Suez', 'SCA declaration', 'Medium', 'Ready to file'],
  ['Orion Star', 'Bosporus', 'Marmara → Black Sea', 'SP-1 notification', 'Low', 'Submitted'],
  ['Northwind Trader', 'Kiel Canal', 'Brunsbüttel → Kiel', 'Pilotage request', 'Low', 'Cleared'],
  ['Blue Horizon', 'Malacca Strait', 'Port Klang → Singapore', 'ISPS update', 'Medium', 'Watching'],
];

const documentRows = [
  ['Certificate of Registry', 'MV Atlantic Vale', 'Extracted', '98%', '2 min ago'],
  ['PCSOPEP Plan', 'MV Atlantic Vale', 'Flagged', '84%', '18 min ago'],
  ['Crew Manifest', 'Sea Meridian', 'Extracted', '96%', '41 min ago'],
  ['Cargo Declaration', 'Orion Star', 'Validated', '99%', '1h ago'],
];

const sprintCards = [
  ['Sprint 3', 'Batch Filing Queue', 'Create, validate, and submit multi-vessel packages from one command surface.', 'Live'],
  ['Sprint 3', 'Document Intelligence', 'OCR-ready vault with extraction confidence, mismatch flags, and certificate mapping.', 'Live'],
  ['Sprint 4', 'Client Portal Layer', 'Share filing status, exceptions, and document requests without email chains.', 'MVP'],
  ['Sprint 4', 'Automation Rules', 'Route alerts by waterway, risk level, owner, and deadline window.', 'MVP'],
];

function safeParse(value) {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function setPage(page) {
  state.activePage = page;
  persist();
  render();
}

function setFilter(value) {
  state.statusFilter = value;
  render();
}

function setQuery(value) {
  state.query = value;
  render();
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  persist();
  render();
}

function toggleTask(id) {
  state.tasks = state.tasks.map(task => task.id === id ? { ...task, done: !task.done } : task);
  persist();
  render();
}

function addTask(event) {
  event.preventDefault();
  const input = event.target.querySelector('input');
  const value = input.value.trim();
  if (!value) return;
  state.tasks = [{ id: Date.now(), text: value, done: false }, ...state.tasks];
  input.value = '';
  persist();
  render();
}

function addQueueItem() {
  const next = Math.floor(Math.random() * 9000) + 1000;
  state.queue = [
    { id: `NF-${next}`, vessel: 'New Transit Package', route: 'Panama Canal', due: 'Draft', risk: 'Medium', status: 'Needs review', owner: 'Unassigned' },
    ...state.queue,
  ];
  persist();
  render();
}

function badge(value) {
  const normalized = String(value).toLowerCase().replace(/\s+/g, '-');
  return `<span class="badge ${normalized}">${value}</span>`;
}

function pageTitle() {
  const all = navGroups.flatMap(group => group.items);
  return all.find(([id]) => id === state.activePage)?.[1] || 'Command Center';
}

function shell(content) {
  return `
    <div class="app-shell ${state.sidebarCollapsed ? 'is-collapsed' : ''}">
      <aside class="sidebar" id="sidebar">
        <div class="brand-row">
          <img src="/assets/neptune-mark.svg" alt="Neptune" />
          <div>
            <strong>Neptune</strong>
            <span>Maritime CRM</span>
          </div>
        </div>
        <button class="sidebar-toggle" data-action="toggle-sidebar" aria-label="Toggle navigation">☰</button>
        <nav class="nav-stack">
          ${navGroups.map(group => `
            <details open>
              <summary>${group.label}</summary>
              ${group.items.map(([id, label, icon]) => `
                <button class="nav-item ${state.activePage === id ? 'active' : ''}" data-page="${id}">
                  <span>${icon}</span><em>${label}</em>
                </button>
              `).join('')}
            </details>
          `).join('')}
        </nav>
        <div class="sidebar-card">
          <span class="eyebrow">MVP Status</span>
          <strong>Sprints 3 & 4 included</strong>
          <p>Filing automation, document intelligence, portals, integrations, and audit controls are wired into the prototype.</p>
        </div>
      </aside>

      <main class="main-panel">
        <header class="topbar">
          <button class="mobile-menu" data-action="toggle-sidebar">☰</button>
          <div>
            <span class="eyebrow">Neptune Command Suite</span>
            <h1>${pageTitle()}</h1>
          </div>
          <label class="search-box">
            <span>⌕</span>
            <input type="search" placeholder="Search vessels, clients, filings..." value="${escapeHtml(state.query)}" data-action="search" />
          </label>
          <div class="profile-chip">
            <span></span>
            <div><strong>Francis</strong><small>Workspace Admin</small></div>
          </div>
        </header>
        ${content}
      </main>
    </div>
  `;
}

function commandCenter() {
  return `
    <section class="hero-grid">
      <div class="hero-card glass-card">
        <span class="eyebrow">Premium Maritime Operating System</span>
        <h2>Turn every transit, document, deadline, and client update into one clean command view.</h2>
        <p>Neptune gives agents and fleet operators a polished CRM layer with compliance workflows built directly into the account record, vessel profile, and filing queue.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-page="filing-builder">Build filing package</button>
          <button class="secondary-btn" data-page="analytics">View executive analytics</button>
        </div>
      </div>
      <div class="mission-card glass-card">
        <span class="eyebrow">Next deadline</span>
        <strong>MV Atlantic Vale</strong>
        <p>Panama Canal PCSOPEP package needs manifest validation before the 96-hour window closes.</p>
        <div class="deadline-meter"><span style="width: 68%"></span></div>
        <small>8h 24m remaining · high risk</small>
      </div>
    </section>

    <section class="metric-grid">
      ${metrics.map(([label, value, delta, sub]) => `
        <article class="metric-card glass-card">
          <span>${label}</span>
          <strong>${value}</strong>
          <em>${delta}</em>
          <small>${sub}</small>
        </article>
      `).join('')}
    </section>

    <section class="two-column">
      <div class="panel glass-card">
        <div class="panel-head">
          <div><span class="eyebrow">Live Queue</span><h3>Priority filings</h3></div>
          <button class="secondary-btn compact" data-action="add-queue">+ Add filing</button>
        </div>
        ${queueTable()}
      </div>
      <div class="panel glass-card">
        <div class="panel-head">
          <div><span class="eyebrow">Operator Focus</span><h3>Tasks</h3></div>
        </div>
        ${taskList()}
      </div>
    </section>

    <section class="sprint-grid">
      ${sprintCards.map(([sprint, title, body, tag]) => `
        <article class="sprint-card glass-card">
          <span>${sprint}</span>
          <strong>${title}</strong>
          <p>${body}</p>
          ${badge(tag)}
        </article>
      `).join('')}
    </section>
  `;
}

function queueTable() {
  const rows = state.queue.filter(row => {
    const matchesStatus = state.statusFilter === 'All' || row.status === state.statusFilter;
    const q = state.query.toLowerCase();
    const matchesQuery = !q || Object.values(row).join(' ').toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return `
    <div class="filter-row">
      ${['All', 'Needs review', 'Ready to file', 'Submitted'].map(value => `<button class="filter-chip ${state.statusFilter === value ? 'active' : ''}" data-filter="${value}">${value}</button>`).join('')}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Vessel</th><th>Waterway</th><th>Due</th><th>Risk</th><th>Status</th><th>Owner</th></tr></thead>
        <tbody>
          ${rows.map(row => `<tr><td>${row.id}</td><td>${row.vessel}</td><td>${row.route}</td><td>${row.due}</td><td>${badge(row.risk)}</td><td>${badge(row.status)}</td><td>${row.owner}</td></tr>`).join('') || `<tr><td colspan="7">No filings match the current search.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function taskList() {
  return `
    <form class="task-form" data-action="add-task">
      <input placeholder="Add an operational task..." />
      <button class="primary-btn compact">Add</button>
    </form>
    <div class="task-list">
      ${state.tasks.map(task => `
        <label class="task-item ${task.done ? 'done' : ''}">
          <input type="checkbox" ${task.done ? 'checked' : ''} data-task="${task.id}" />
          <span>${escapeHtml(task.text)}</span>
        </label>
      `).join('')}
    </div>
  `;
}

function voyagesPage() {
  return `
    <section class="panel glass-card">
      <div class="panel-head"><div><span class="eyebrow">Transit Pipeline</span><h3>Voyages by waterway and clearance stage</h3></div><button class="primary-btn compact">New voyage</button></div>
      <div class="kanban-grid">
        ${['Intake', 'Documents', 'Validation', 'Submitted'].map(stage => `
          <div class="kanban-column"><h4>${stage}</h4>${voyageRows.filter((_, i) => i % 4 === ['Intake','Documents','Validation','Submitted'].indexOf(stage)).map(row => `<article class="mini-card"><strong>${row[0]}</strong><span>${row[1]}</span><small>${row[3]}</small>${badge(row[4])}</article>`).join('')}</div>
        `).join('')}
      </div>
    </section>
  `;
}

function vesselsPage() {
  return `
    <section class="panel glass-card">
      <div class="panel-head"><div><span class="eyebrow">Fleet Records</span><h3>Vessel intelligence</h3></div><button class="primary-btn compact">Add vessel</button></div>
      ${simpleTable(['Vessel','Current route','Transit requirement','Risk','Status'], voyageRows.map(row => [row[0], row[2], row[3], badge(row[4]), badge(row[5])]))}
    </section>
  `;
}

function clientsPage() {
  const rows = [
    ['Apex Marine Logistics', '18 active vessels', '$42.8K MRR', 'Preferred', '4 open exceptions'],
    ['Bluewater Freight', '9 active vessels', '$18.2K MRR', 'Growth', '1 open exception'],
    ['Northline Chartering', '15 active vessels', '$31.4K MRR', 'Strategic', '0 open exceptions'],
    ['Meridian Bulk', '6 active vessels', '$12.9K MRR', 'New', '2 open exceptions'],
  ];
  return `
    <section class="panel glass-card">
      <div class="panel-head"><div><span class="eyebrow">CRM</span><h3>Client command records</h3></div><button class="primary-btn compact">Create client</button></div>
      ${simpleTable(['Client','Fleet','Revenue','Segment','Exceptions'], rows)}
    </section>
  `;
}

function compliancePage() {
  return `
    <section class="two-column">
      <div class="panel glass-card">
        <div class="panel-head"><div><span class="eyebrow">Deadline Board</span><h3>Compliance alerts</h3></div></div>
        ${queueTable()}
      </div>
      <div class="panel glass-card">
        <div class="panel-head"><div><span class="eyebrow">Rules Engine</span><h3>Waterway checks</h3></div></div>
        <div class="rules-list">
          ${['Panama 96-hour pre-arrival window', 'Suez IMDG hazardous cargo validation', 'Bosporus SP-1 notification completeness', 'Kiel pilotage and tug booking check', 'Saint Lawrence Seaway inspection package'].map((rule, index) => `<div><span>${index + 1}</span><strong>${rule}</strong><em>Enabled</em></div>`).join('')}
        </div>
      </div>
    </section>
  `;
}

function filingBuilderPage() {
  return `
    <section class="builder-grid">
      <div class="panel glass-card">
        <div class="panel-head"><div><span class="eyebrow">Sprint 3</span><h3>Filing package builder</h3></div><button class="primary-btn compact" data-action="add-queue">Generate draft</button></div>
        <div class="stepper">
          ${['Select vessel', 'Match waterway rules', 'Attach documents', 'Validate exceptions', 'Submit package'].map((step, i) => `<div class="step ${i < 3 ? 'complete' : ''}"><span>${i + 1}</span><strong>${step}</strong><p>${i < 3 ? 'Complete' : 'Pending operator approval'}</p></div>`).join('')}
        </div>
      </div>
      <div class="panel glass-card">
        <div class="panel-head"><div><span class="eyebrow">Validation</span><h3>Package health</h3></div></div>
        <div class="health-score"><strong>86</strong><span>/100</span></div>
        <p class="muted">Two fields need operator review before Neptune should allow one-click submission.</p>
        <div class="exception-list"><div>⚠ Crew count mismatch between manifest and registry</div><div>⚠ PCSOPEP renewal date confidence below threshold</div><div>✓ Cargo declaration format accepted</div></div>
      </div>
    </section>
  `;
}

function documentsPage() {
  return `
    <section class="panel glass-card">
      <div class="panel-head"><div><span class="eyebrow">Document Vault</span><h3>Extraction queue</h3></div><button class="primary-btn compact">Upload documents</button></div>
      ${simpleTable(['Document','Vessel','Status','Confidence','Updated'], documentRows.map(row => [row[0], row[1], badge(row[2]), row[3], row[4]]))}
    </section>
  `;
}

function auditPage() {
  return `
    <section class="panel glass-card">
      <div class="panel-head"><div><span class="eyebrow">Sprint 4</span><h3>Audit timeline</h3></div></div>
      <div class="timeline">
        ${[
          ['2 min ago', 'System extracted Certificate of Registry fields with 98% confidence.'],
          ['18 min ago', 'Compliance flagged PCSOPEP renewal date for manual approval.'],
          ['34 min ago', 'Agent Desk submitted Suez declaration for Sea Meridian.'],
          ['1h ago', 'Client portal shared Orion Star clearance packet.'],
          ['3h ago', 'Automation rule escalated high-risk filings under 12 hours.'],
        ].map(([time, text]) => `<div><span>${time}</span><p>${text}</p></div>`).join('')}
      </div>
    </section>
  `;
}

function analyticsPage() {
  return `
    <section class="metric-grid">
      ${metrics.map(([label, value, delta, sub]) => `<article class="metric-card glass-card"><span>${label}</span><strong>${value}</strong><em>${delta}</em><small>${sub}</small></article>`).join('')}
    </section>
    <section class="two-column">
      <div class="panel glass-card chart-panel"><div class="panel-head"><div><span class="eyebrow">Executive View</span><h3>Volume by waterway</h3></div></div>${barChart([72, 58, 44, 31, 26, 18])}</div>
      <div class="panel glass-card chart-panel"><div class="panel-head"><div><span class="eyebrow">Margin Control</span><h3>Manual hours reduced</h3></div></div>${barChart([18, 24, 38, 51, 66, 78])}</div>
    </section>
  `;
}

function automationPage() {
  return `
    <section class="panel glass-card">
      <div class="panel-head"><div><span class="eyebrow">Sprint 4</span><h3>Automation and integrations</h3></div><button class="primary-btn compact">New rule</button></div>
      <div class="automation-grid">
        ${[
          ['Deadline escalation', 'Notify owner 12h before filing window closes', 'Enabled'],
          ['Document extraction', 'Auto-map certificate values to vessel profile', 'Enabled'],
          ['Client portal update', 'Publish approved status changes to customers', 'MVP'],
          ['Webhook monitor', 'Track authority portal status callbacks', 'MVP'],
          ['Exception routing', 'Route high-risk files to senior compliance users', 'Enabled'],
          ['Revenue alerts', 'Flag clients with margin leakage from agent hours', 'MVP'],
        ].map(([title, body, tag]) => `<article class="mini-card"><strong>${title}</strong><p>${body}</p>${badge(tag)}</article>`).join('')}
      </div>
    </section>
  `;
}

function settingsPage() {
  return `
    <section class="builder-grid">
      <div class="panel glass-card">
        <div class="panel-head"><div><span class="eyebrow">Workspace</span><h3>Security and roles</h3></div></div>
        ${simpleTable(['Role','Access','Status'], [['Admin','All modules + billing', badge('Enabled')], ['Compliance Lead','Filings + documents + audit', badge('Enabled')], ['Client Viewer','Portal-only read access', badge('MVP')], ['Agent Desk','Assigned vessel work queues', badge('Enabled')]])}
      </div>
      <div class="panel glass-card">
        <div class="panel-head"><div><span class="eyebrow">Preferences</span><h3>Notification routing</h3></div></div>
        <label class="toggle-row"><span>Deadline alerts</span><input type="checkbox" checked /></label>
        <label class="toggle-row"><span>Client portal digest</span><input type="checkbox" checked /></label>
        <label class="toggle-row"><span>Authority callback failures</span><input type="checkbox" checked /></label>
        <label class="toggle-row"><span>Weekly executive report</span><input type="checkbox" /></label>
      </div>
    </section>
  `;
}

function simpleTable(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function barChart(values) {
  return `<div class="bar-chart">${values.map((value, i) => `<div><span style="height:${value}%"></span><small>W${i + 1}</small></div>`).join('')}</div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

const pages = {
  'command-center': commandCenter,
  voyages: voyagesPage,
  vessels: vesselsPage,
  clients: clientsPage,
  compliance: compliancePage,
  'filing-builder': filingBuilderPage,
  documents: documentsPage,
  audit: auditPage,
  analytics: analyticsPage,
  automation: automationPage,
  settings: settingsPage,
};

function render() {
  const content = (pages[state.activePage] || pages['command-center'])();
  app.innerHTML = shell(content);
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => setPage(button.dataset.page));
  });
  document.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => setFilter(button.dataset.filter));
  });
  document.querySelectorAll('[data-action="toggle-sidebar"]').forEach(button => {
    button.addEventListener('click', toggleSidebar);
  });
  document.querySelectorAll('[data-action="add-queue"]').forEach(button => {
    button.addEventListener('click', addQueueItem);
  });
  const search = document.querySelector('[data-action="search"]');
  if (search) search.addEventListener('input', event => setQuery(event.target.value));
  const taskForm = document.querySelector('[data-action="add-task"]');
  if (taskForm) taskForm.addEventListener('submit', addTask);
  document.querySelectorAll('[data-task]').forEach(input => {
    input.addEventListener('change', () => toggleTask(Number(input.dataset.task)));
  });
}

render();
