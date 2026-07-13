"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Overview = {
  generatedAt: string;
  summary: Record<string, number>;
  signupTrend: { label: string; signups: number }[];
  statusDistribution: { status: string; count: number }[];
  recentSignups: any[];
  recentErrors: any[];
  topErrors: any[];
  health: { key: string; label: string; configured: boolean; critical: boolean }[];
};

export function PlatformAdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [bugFilter, setBugFilter] = useState("Unresolved");
  const [signupQuery, setSignupQuery] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/platform-admin/overview", { cache: "no-store" });
    const result = await response.json();
    if (response.status === 401) {
      window.location.href = "/login?from=/platform-admin";
      return;
    }
    if (!response.ok) {
      setMessage(result.error || "Unable to load the platform portal.");
      setLoading(false);
      return;
    }
    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const maxSignups = Math.max(...(data?.signupTrend || []).map(item => Number(item.signups)), 1);
  const filteredBugs = useMemo(() => {
    const rows = data?.recentErrors || [];
    if (bugFilter === "All") return rows;
    if (bugFilter === "Resolved") return rows.filter(item => item.resolved_at);
    if (bugFilter === "Critical") return rows.filter(item => !item.resolved_at && item.severity === "critical");
    return rows.filter(item => !item.resolved_at);
  }, [data, bugFilter]);

  const filteredSignups = useMemo(() => {
    const rows = data?.recentSignups || [];
    const needle = signupQuery.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(item => [item.name, item.admin_name, item.admin_email, item.status, item.plan].join(" ").toLowerCase().includes(needle));
  }, [data, signupQuery]);

  async function setResolved(id: string, resolved: boolean) {
    const response = await fetch("/api/platform-admin/overview", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, resolved })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Unable to update the bug record.");
      return;
    }
    setMessage(resolved ? "Bug marked resolved." : "Bug reopened.");
    await load();
  }

  function exportSignups() {
    if (!filteredSignups.length) {
      setMessage("There are no signup records to export.");
      return;
    }
    const columns = ["Organization", "Administrator", "Email", "Created", "Plan", "Status", "Trial/Period End", "Vessels", "Duties", "Ports"];
    const rows = filteredSignups.map(item => [
      item.name,
      item.admin_name || "",
      item.admin_email || "",
      item.created_at || "",
      item.plan || "",
      item.status || "",
      item.current_period_end || "",
      item.vessels || 0,
      item.duties || 0,
      item.ports || 0
    ]);
    const csv = [columns, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `neptune-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Signup analytics exported.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <main className="platform-admin-shell">
      <aside className="platform-admin-rail glass">
        <Link className="brand platform-owner-brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Platform Control</small></span></Link>
        <div className="platform-admin-status"><span>Owner portal</span><b>Signups, trials & bugs</b><small>Auto-refreshes every 60 seconds</small></div>
        <nav>
          <a href="#overview">Platform overview</a>
          <a href="#signups">Signup analytics</a>
          <a href="#bugs">Bug monitor</a>
          <a href="#health">System health</a>
        </nav>
        <div className="platform-admin-links">
          <Link className="btn" href="/admin">Tenant CRM admin</Link>
          <Link className="btn" href="/dashboard">Vessel dashboard</Link>
          <button className="btn danger" onClick={logout}>Logout</button>
        </div>
      </aside>

      <section className="platform-admin-main">
        <header className="platform-admin-header">
          <div><p className="eyebrow">Neptune Platform Administration</p><h1>Growth, access, and system health.</h1><p>Real signup analytics, 14-day trial status, paid conversions, environment readiness, and application-reported bugs.</p></div>
          <div className="actions"><button className="btn" onClick={load}>Refresh now</button><button className="btn gold" onClick={exportSignups}>Export signups</button></div>
        </header>

        {message && <div className="form-message platform-admin-message">{message}</div>}
        {loading || !data ? <section className="platform-admin-loading glass"><div className="radar" /><p>Loading live Neptune platform analytics...</p></section> : <>
          <section className="platform-summary" id="overview">
            <SummaryCard label="Organizations" value={data.summary.totalOrganizations} note={`${data.summary.signupsToday} today`} />
            <SummaryCard label="Signups · 7 days" value={data.summary.signups7d} note={`${data.summary.signups30d} in 30 days`} />
            <SummaryCard label="Active trials" value={data.summary.activeTrials} note={`${data.summary.expiredTrials} expired`} />
            <SummaryCard label="Paid accounts" value={data.summary.activePaid} note={`${data.summary.conversionRate}% conversion`} />
            <SummaryCard label="Unresolved bugs" value={data.summary.unresolvedBugs} note={`${data.summary.criticalBugs} critical`} danger={data.summary.criticalBugs > 0} />
            <SummaryCard label="Errors · 24 hours" value={data.summary.bugsLast24h} note={`${data.summary.bugsLastHour} last hour`} danger={data.summary.bugsLastHour > 0} />
          </section>

          <section className="platform-admin-grid">
            <article className="platform-panel glass premium platform-panel-wide">
              <div className="platform-panel-head"><div><p className="eyebrow">Signup Velocity</p><h2>New organizations · 14 days</h2></div><span className="status">Live database</span></div>
              <div className="signup-chart">{data.signupTrend.map(item => <div key={item.label}><div className="signup-bar-track"><i style={{ height: `${Math.max(item.signups ? 10 : 2, Number(item.signups) / maxSignups * 100)}%` }}><span>{item.signups}</span></i></div><b>{item.label}</b></div>)}</div>
            </article>

            <article className="platform-panel glass premium">
              <div className="platform-panel-head"><div><p className="eyebrow">Subscription Status</p><h2>Trial and paid mix</h2></div></div>
              <div className="status-distribution">{data.statusDistribution.length ? data.statusDistribution.map(item => <div key={item.status}><span>{item.status}</span><b>{item.count}</b><i style={{ width: `${Math.max(8, item.count / Math.max(data.summary.totalOrganizations, 1) * 100)}%` }} /></div>) : <Empty title="No subscriptions yet" body="Subscription status appears after the first organization signs up." />}</div>
            </article>

            <article className="platform-panel glass premium" id="health">
              <div className="platform-panel-head"><div><p className="eyebrow">System Health</p><h2>Production connections</h2></div></div>
              <div className="health-grid">{data.health.map(item => <div className={item.configured ? "healthy" : item.critical ? "critical" : "warning"} key={item.key}><i>{item.configured ? "✓" : "!"}</i><span>{item.label}</span><b>{item.configured ? "Connected" : item.critical ? "Required" : "Optional"}</b></div>)}</div>
            </article>
          </section>

          <section className="platform-panel glass premium" id="signups">
            <div className="platform-panel-head platform-table-head"><div><p className="eyebrow">Signup Analytics</p><h2>Organizations and trial activity</h2></div><input value={signupQuery} onChange={event => setSignupQuery(event.target.value)} placeholder="Search organization, admin, plan, or status" /></div>
            {filteredSignups.length ? <div className="data-grid"><table><thead><tr><th>Organization</th><th>Administrator</th><th>Created</th><th>Access</th><th>Period end</th><th>Usage</th></tr></thead><tbody>{filteredSignups.map(item => <tr key={item.id}><td><b>{item.name}</b><small>{item.id}</small></td><td>{item.admin_name || "—"}<small>{item.admin_email || "No email"}</small></td><td>{formatDate(item.created_at)}</td><td><span className={`platform-status-pill ${statusClass(item.status, item.current_period_end)}`}>{accessLabel(item.status, item.current_period_end)}</span><small>{item.plan || "No plan"}</small></td><td>{item.current_period_end ? formatDate(item.current_period_end) : "—"}</td><td>{item.vessels || 0} vessels · {item.duties || 0} duties · {item.ports || 0} ports</td></tr>)}</tbody></table></div> : <Empty title="No signup records" body="New organization trials will appear here immediately after registration." />}
          </section>

          <section className="platform-admin-grid bug-grid" id="bugs">
            <article className="platform-panel glass premium platform-panel-wide">
              <div className="platform-panel-head platform-table-head"><div><p className="eyebrow">Immediate Bug Information</p><h2>Application error feed</h2></div><select value={bugFilter} onChange={event => setBugFilter(event.target.value)}><option>Unresolved</option><option>Critical</option><option>Resolved</option><option>All</option></select></div>
              {filteredBugs.length ? <div className="bug-list">{filteredBugs.map(item => <article key={item.id} className={`bug-item ${item.severity}`}><div className="bug-item-head"><div><span>{item.severity || "error"}</span><b>{item.message}</b></div><time>{formatDate(item.created_at)}</time></div><p>{item.method || "APP"} · {item.route || "Unknown route"}{item.status_code ? ` · HTTP ${item.status_code}` : ""}</p><div className="bug-meta"><span>Source: {item.source}</span><span>Account: {item.user_email || item.org_id || "Anonymous"}</span><span>Fingerprint: {item.fingerprint || "—"}</span></div><div className="actions"><button className={`btn ${item.resolved_at ? "" : "gold"}`} onClick={() => setResolved(item.id, !item.resolved_at)}>{item.resolved_at ? "Reopen" : "Mark resolved"}</button></div></article>)}</div> : <Empty title="No bugs in this view" body="Client crashes and failed server requests will appear here as soon as they are reported." />}
            </article>

            <article className="platform-panel glass premium">
              <div className="platform-panel-head"><div><p className="eyebrow">Recurring Issues</p><h2>Top fingerprints · 7 days</h2></div></div>
              <div className="top-error-list">{data.topErrors.length ? data.topErrors.map(item => <div key={item.fingerprint}><b>{item.message}</b><span>{item.route || "Unknown route"}</span><strong>{item.occurrences}×</strong><small>Last seen {formatDate(item.last_seen)}</small></div>) : <Empty title="No recurring errors" body="The portal has not detected repeating application failures." />}</div>
            </article>
          </section>

          <p className="platform-generated">Last refreshed {formatDate(data.generatedAt)} · Database values only · No demo signups or synthetic bug data</p>
        </>}
      </section>
    </main>
  );
}

function SummaryCard({ label, value, note, danger = false }: { label: string; value: number | string; note: string; danger?: boolean }) {
  return <article className={`platform-summary-card glass premium ${danger ? "danger" : ""}`}><span>{label}</span><b>{value}</b><small>{note}</small><i /></article>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="platform-empty"><div className="icon">✦</div><h3>{title}</h3><p>{body}</p></div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "—") : date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function trialExpired(status: string, periodEnd: string | null) {
  return ["trial", "trialing"].includes(String(status || "").toLowerCase()) && (!periodEnd || new Date(periodEnd).getTime() <= Date.now());
}

function accessLabel(status: string, periodEnd: string | null) {
  if (trialExpired(status, periodEnd)) return "Trial expired";
  if (["trial", "trialing"].includes(String(status || "").toLowerCase())) return "Active trial";
  if (String(status || "").toLowerCase() === "active") return "Paid active";
  return status || "No subscription";
}

function statusClass(status: string, periodEnd: string | null) {
  if (trialExpired(status, periodEnd)) return "expired";
  if (["trial", "trialing"].includes(String(status || "").toLowerCase())) return "trial";
  if (String(status || "").toLowerCase() === "active") return "paid";
  return "attention";
}
