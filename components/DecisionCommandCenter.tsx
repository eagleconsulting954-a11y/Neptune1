"use client";

type DecisionCommandCenterProps = {
  data: Record<string, any>;
  openTab: (tab: string) => void;
  createVessel: () => void;
  createDuty: () => void;
};

function moduleAllowed(data: Record<string, any>, tab: string) {
  const moduleByTab: Record<string, string> = {
    Command: "command",
    Vessels: "vessels",
    "Maritime Intel": "maritime_intel",
    Delegation: "delegation",
    Maintenance: "maintenance",
    Certificates: "certificates",
    Incidents: "incidents",
    CRM: "crm",
    Activity: "activity"
  };
  const modules = data.entitlement?.access?.modules || [];
  return !moduleByTab[tab] || modules.includes(moduleByTab[tab]);
}

function workspaceIsEmpty(data: Record<string, any>) {
  return [
    data.vessels,
    data.duties,
    data.workOrders,
    data.certificates,
    data.incidents,
    data.crm,
    data.events,
    data.ports,
    data.bunkerPlans,
    data.mrccContacts
  ].every(records => !records?.length);
}

function TrendChart({ points }: { points: { date: string; readiness: number; riskLoad: number; openWork: number }[] }) {
  const width = 720;
  const height = 220;
  const left = 34;
  const right = 16;
  const top = 18;
  const bottom = 36;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxRisk = Math.max(...points.map(point => point.riskLoad), 1);
  const x = (index: number) => left + (points.length === 1 ? chartWidth / 2 : index / (points.length - 1) * chartWidth);
  const readinessY = (value: number) => top + chartHeight - Math.max(0, Math.min(100, value)) / 100 * chartHeight;
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${readinessY(point.readiness).toFixed(1)}`).join(" ");

  return (
    <div className="decision-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fleet readiness and operational risk trend">
        {[0, 25, 50, 75, 100].map(value => {
          const y = readinessY(value);
          return <g key={value}><line x1={left} x2={width - right} y1={y} y2={y} className="decision-grid-line" /><text x={4} y={y + 4} className="decision-axis-label">{value}%</text></g>;
        })}
        {points.map((point, index) => {
          const barHeight = point.riskLoad / maxRisk * chartHeight * .42;
          return <rect key={`${point.date}-risk`} x={x(index) - 9} y={top + chartHeight - barHeight} width={18} height={barHeight} rx={5} className="decision-risk-bar" />;
        })}
        {points.length > 1 && <path d={path} className="decision-readiness-line" />}
        {points.map((point, index) => <g key={point.date}><circle cx={x(index)} cy={readinessY(point.readiness)} r={5} className="decision-readiness-point" /><text x={x(index)} y={height - 10} textAnchor="middle" className="decision-date-label">{new Date(`${point.date}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}</text></g>)}
      </svg>
      <div className="decision-chart-legend"><span><i className="readiness" />Readiness</span><span><i className="risk" />Recorded risk load</span></div>
    </div>
  );
}

function EmptyDecisionWorkspace({ data, openTab, createVessel, createDuty }: DecisionCommandCenterProps) {
  const canDelegate = moduleAllowed(data, "Delegation");
  const canUseIntel = moduleAllowed(data, "Maritime Intel");
  const canUseCrm = moduleAllowed(data, "CRM");

  return (
    <section className="first-run-workspace decision-first-run glass">
      <div>
        <p className="eyebrow">Clean Decision Workspace</p>
        <h2>Build the first operational baseline from your own data.</h2>
        <p>Neptune has not inserted sample vessels, fake contacts, synthetic duties, or invented alerts. Fleet trends, critical warnings, and recommendations begin when your team enters real records.</p>
        <div className="decision-package-badge"><span>{data.entitlement?.planName || "Neptune"}</span><b>14-day package trial</b></div>
      </div>
      <div className="first-run-steps">
        <button onClick={createVessel}><span>1</span><div><b>Add your first vessel</b><small>Enter IMO, status, and readiness to establish the first command baseline.</small></div></button>
        {canDelegate && <button onClick={createDuty}><span>2</span><div><b>Assign the first operational duty</b><small>Criticality, owner, and status will feed the command alert queue.</small></div></button>}
        {canUseIntel && <button onClick={() => openTab("Maritime Intel")}><span>{canDelegate ? 3 : 2}</span><div><b>Add ports and voyage intelligence</b><small>Use real locations, congestion snapshots, bunker plans, and verified MRCC contacts.</small></div></button>}
        {canUseCrm && <button onClick={() => openTab("CRM")}><span>{canDelegate && canUseIntel ? 4 : 3}</span><div><b>Build the commercial pipeline</b><small>Customer accounts and opportunity values will populate fleet-commercial analytics.</small></div></button>}
      </div>
    </section>
  );
}

export function DecisionCommandCenter(props: DecisionCommandCenterProps) {
  const { data, openTab } = props;
  if (workspaceIsEmpty(data)) return <EmptyDecisionWorkspace {...props} />;

  const insights = data.insights || {};
  const alerts = insights.alerts || [];
  const recommendations = insights.recommendations || [];
  const points = insights.trend?.points || [];
  const score = Number(insights.score || 0);
  const criticalAlerts = alerts.filter((item: any) => item.severity === "critical").length;
  const totalOpenWork = Number(data.kpis?.openDuties || 0) + Number(data.kpis?.openWorkOrders || 0);
  const outlookClass = String(insights.outlook || "stable").toLowerCase().replaceAll(" ", "-");

  const modules = [
    ["Maritime Intel", `${data.ports?.length || 0} ports`, "Weather, ocean, congestion, bunkering, and rescue intelligence"],
    ["Delegation", `${data.duties?.length || 0} duties`, "Command ownership and critical assignments"],
    ["Maintenance", `${data.workOrders?.length || 0} work orders`, "Engineering workload and priority exposure"],
    ["Certificates", `${data.certificates?.length || 0} certificates`, "Expiry windows and compliance evidence"],
    ["Incidents", `${data.incidents?.length || 0} incidents`, "RCA, corrective actions, and recurrence control"],
    ["CRM", `$${Number(data.kpis?.pipeline || 0).toLocaleString()}`, "Commercial pipeline and account opportunity"],
    ["Activity", `${data.events?.length || 0} events`, "Operational audit and decision history"]
  ].filter(([title]) => moduleAllowed(data, title));

  return (
    <div className="decision-command-center">
      <section className={`decision-outlook glass ${outlookClass}`}>
        <div className="decision-score" style={{ "--decision-score": `${score * 3.6}deg` } as React.CSSProperties}>
          <div><b>{score}</b><span>Decision readiness</span></div>
        </div>
        <div className="decision-outlook-copy">
          <div className="decision-outlook-topline"><p className="eyebrow">Fleet Outlook</p><span className={`decision-outlook-pill ${outlookClass}`}>{insights.outlook || "Awaiting data"}</span></div>
          <h2>{insights.summary || "Neptune is evaluating your organization records."}</h2>
          <p>{insights.methodology || "Analysis uses only organization-entered operational records."}</p>
          <div className="decision-outlook-meta"><span>{data.entitlement?.planName || "Neptune package"}</span><span>Updated {insights.generatedAt ? new Date(insights.generatedAt).toLocaleString([], { hour: "numeric", minute: "2-digit" }) : "now"}</span></div>
        </div>
      </section>

      <section className="decision-kpi-grid">
        <article><span>Fleet readiness</span><b>{data.kpis?.readiness || 0}%</b><small>{insights.trend?.readinessChange === null || insights.trend?.readinessChange === undefined ? "Baseline captured" : `${insights.trend.readinessChange >= 0 ? "+" : ""}${insights.trend.readinessChange} pts since prior snapshot`}</small></article>
        <article className={criticalAlerts ? "critical" : ""}><span>Critical signals</span><b>{criticalAlerts}</b><small>{criticalAlerts ? "Immediate command review" : "No critical alert categories"}</small></article>
        <article><span>Open operational work</span><b>{totalOpenWork}</b><small>{data.kpis?.openDuties || 0} duties · {data.kpis?.openWorkOrders || 0} work orders</small></article>
        <article><span>Compliance window</span><b>{data.kpis?.expiringCertificates || 0}</b><small>Expired or inside 45 days</small></article>
      </section>

      <section className="decision-main-grid">
        <article className="decision-panel decision-trend-panel glass">
          <div className="decision-panel-head"><div><p className="eyebrow">Fleet Trends</p><h3>Readiness versus recorded risk load</h3></div><span className="status">30-day view</span></div>
          {points.length ? <TrendChart points={points} /> : <div className="decision-empty"><b>No trend baseline yet</b><p>Neptune will create the first real snapshot when dashboard data is available.</p></div>}
          <p className="decision-baseline-note">{insights.trend?.baselineStatus}</p>
        </article>

        <article className="decision-panel glass">
          <div className="decision-panel-head"><div><p className="eyebrow">Critical Alerts</p><h3>What needs attention now</h3></div><span className={`decision-count ${alerts.length ? "active" : ""}`}>{alerts.length}</span></div>
          {alerts.length ? <div className="decision-alert-list">{alerts.slice(0, 6).map((alert: any) => <button key={alert.id} className={`decision-alert ${alert.severity}`} onClick={() => openTab(alert.module)}><span className="decision-alert-icon">{alert.severity === "critical" ? "!" : alert.severity === "warning" ? "▲" : "●"}</span><div><b>{alert.title}</b><p>{alert.detail}</p><small>Open {alert.module}</small></div><strong>{alert.count}</strong></button>)}</div> : <div className="decision-empty positive"><b>No critical signals detected</b><p>The current organization records do not contain open critical alert conditions.</p></div>}
        </article>
      </section>

      <section className="decision-main-grid recommendations-grid">
        <article className="decision-panel decision-recommendation-panel glass">
          <div className="decision-panel-head"><div><p className="eyebrow">Predictive Recommendations</p><h3>Next-best actions from current risk signals</h3></div><span className="status">Rules-based</span></div>
          {recommendations.length ? <div className="decision-recommendations">{recommendations.map((item: any, index: number) => <button key={item.id} onClick={() => openTab(item.module)}><span className={`recommendation-priority ${item.priority.toLowerCase()}`}>{item.priority}</span><div><small>Recommendation {String(index + 1).padStart(2, "0")}</small><b>{item.title}</b><p>{item.rationale}</p><em>{item.action}</em></div><strong>{item.signal}</strong></button>)}</div> : <div className="decision-empty positive"><b>No corrective recommendation is currently triggered</b><p>Keep records current so Neptune can identify changes in readiness, workload, compliance, and risk.</p></div>}
        </article>

        <article className="decision-panel glass">
          <div className="decision-panel-head"><div><p className="eyebrow">Decision Modules</p><h3>Signals feeding the outlook</h3></div></div>
          <div className="decision-module-list">{modules.map(([title, value, note]) => <button key={title} onClick={() => openTab(title)}><div><span>{title}</span><b>{value}</b></div><p>{note}</p><small>Open module →</small></button>)}</div>
        </article>
      </section>
    </div>
  );
}
