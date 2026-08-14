"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const ROLES = [
  ["member", "Member"],
  ["captain", "Captain"],
  ["chief_engineer", "Chief Engineer"],
  ["safety_officer", "Safety Officer"],
  ["fleet_manager", "Fleet Manager"],
  ["org_admin", "Organization Admin"]
];

function when(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function roleLabel(value: string) {
  return ROLES.find(([key]) => key === value)?.[1] || value.replaceAll("_", " ");
}

export function SecurityCenter() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mfaSetup, setMfaSetup] = useState<any>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function load() {
    const response = await fetch("/api/v1/security-center", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login?from=/security-center";
      return;
    }
    if (response.status === 402) {
      window.location.href = "/trial-expired";
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Unable to load the security center.");
      setLoading(false);
      return;
    }
    setData(result);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function action(name: string, payload: Record<string, unknown> = {}, reload = true) {
    setMessage("");
    setError("");
    const response = await fetch("/api/v1/security-center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: name, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Unable to complete this security action.");
      return null;
    }
    if (result.currentSessionRevoked) {
      window.location.href = "/login";
      return result;
    }
    if (reload) await load();
    return result;
  }

  async function startMfa() {
    const result = await action("mfa_setup", {}, false);
    if (result?.setup) {
      setMfaSetup(result.setup);
      setRecoveryCodes([]);
      setMessage("Authenticator setup started. Add the key below to your authenticator, then confirm a six-digit code.");
    }
  }

  async function confirmMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await action("mfa_enable", { setupToken: mfaSetup?.setupToken, code: form.get("code") }, false);
    if (result?.recoveryCodes) {
      setRecoveryCodes(result.recoveryCodes);
      setMfaSetup(null);
      setMessage("Multi-factor authentication is enabled. Store the recovery codes somewhere separate from this device.");
      await load();
    }
  }

  if (loading) return <main className="auth-page"><section className="auth-card glass premium"><p>Loading Neptune security controls...</p></section></main>;
  if (!data) return <main className="auth-page"><section className="auth-card glass premium"><div className="form-message error">{error || "Security center unavailable."}</div></section></main>;

  return <main className="section" style={{ minHeight: "100vh", paddingTop: 28 }}>
    <div className="container" style={{ display: "grid", gap: 18 }}>
      <div className="workspace-header">
        <div><p className="eyebrow">Enterprise security center</p><h1>Identity, access, devices, and audit evidence.</h1><p className="muted">Manage verified identities, MFA, active sessions, vessel permissions, offline devices, and immutable organization events.</p></div>
        <div className="actions"><Link className="btn" href="/dashboard">Back to command</Link>{data.managerAccess && <Link className="btn gold" href="/platform-admin">Platform admin</Link>}</div>
      </div>
      {message && <div className="form-message success">{message}</div>}
      {error && <div className="form-message error">{error}</div>}

      <section className="record-grid">
        <article className="record">
          <p className="eyebrow">Identity assurance</p>
          <h3>{data.security?.email}</h3>
          <p>Verified email: <b>{data.security?.email_verified_at ? "Yes" : "No"}</b></p>
          <p>MFA: <b>{data.security?.mfa_enabled ? "Enabled" : "Not enabled"}</b></p>
          <p>Last login: <b>{when(data.security?.last_login_at)}</b></p>
          {!data.security?.mfa_enabled && <button className="btn gold" onClick={startMfa}>Enable authenticator MFA</button>}
          {data.security?.mfa_enabled && <MfaDisable onSubmit={async (password, code) => {
            const result = await action("mfa_disable", { password, code });
            if (result) setMessage("Multi-factor authentication disabled.");
          }} />}
        </article>

        <article className="record">
          <p className="eyebrow">Session control</p>
          <h3>Signed device sessions</h3>
          <p>{data.sessions?.filter((item: any) => !item.revoked_at).length || 0} active or unexpired session records.</p>
          <button className="btn danger" onClick={async () => { const result = await action("revoke_other_sessions"); if (result) setMessage("Every other Neptune session has been revoked."); }}>Log out all other devices</button>
        </article>

        <article className="record">
          <p className="eyebrow">Organization</p>
          <h3>{data.organization?.name || "Neptune organization"}</h3>
          <p>Role: <b>{roleLabel(data.security?.role || "member")}</b></p>
          <p>Manager controls: <b>{data.managerAccess ? "Enabled" : "Operator scope"}</b></p>
        </article>
      </section>

      {mfaSetup && <article className="record">
        <p className="eyebrow">Authenticator enrollment</p><h3>Add Neptune to your authenticator</h3>
        <p>Manual key:</p><code style={{ display: "block", overflowWrap: "anywhere", padding: 12, border: "1px solid var(--line)", borderRadius: 10 }}>{mfaSetup.secret}</code>
        <details style={{ marginTop: 12 }}><summary>Authenticator URI</summary><code style={{ display: "block", overflowWrap: "anywhere", paddingTop: 8 }}>{mfaSetup.otpauthUri}</code></details>
        <form className="form" onSubmit={confirmMfa} style={{ marginTop: 14 }}><label>Six-digit code<input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" /></label><button className="btn gold">Confirm MFA</button></form>
      </article>}

      {recoveryCodes.length > 0 && <article className="record">
        <p className="eyebrow">One-time recovery codes</p><h3>Save these now</h3><p>Each code works once. They are not displayed again.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>{recoveryCodes.map(code => <code key={code} style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8 }}>{code}</code>)}</div>
      </article>}

      <article className="record">
        <div className="workspace-header"><div><p className="eyebrow">Active sessions</p><h3>Device and browser access</h3></div></div>
        <div className="data-grid"><table><thead><tr><th>Device</th><th>Last seen</th><th>Expires</th><th>Status</th><th>Action</th></tr></thead><tbody>{(data.sessions || []).map((item: any) => <tr key={item.id}><td>{item.device_label || item.user_agent?.slice(0, 54) || "Browser session"}{item.id === data.currentSessionId ? " · current" : ""}</td><td>{when(item.last_seen_at)}</td><td>{when(item.expires_at)}</td><td>{item.revoked_at ? "Revoked" : "Active"}</td><td>{!item.revoked_at && <button className="btn danger" onClick={() => action("revoke_session", { sessionId: item.id })}>Revoke</button>}</td></tr>)}</tbody></table></div>
      </article>

      {data.managerAccess && <>
        <OrganizationControls data={data} action={action} setMessage={setMessage} />
        <UserControls data={data} action={action} setMessage={setMessage} />
        <DeviceControls data={data} action={action} setMessage={setMessage} />
        <AuditControls events={data.audit || []} />
      </>}
    </div>
  </main>;
}

function MfaDisable({ onSubmit }: { onSubmit: (password: string, code: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <div style={{ marginTop: 12 }}>{!open ? <button className="btn danger" onClick={() => setOpen(true)}>Disable MFA</button> : <form className="form" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await onSubmit(String(form.get("password") || ""), String(form.get("code") || "")); setOpen(false); }}><label>Current password<input name="password" type="password" required autoComplete="current-password" /></label><label>Authenticator or recovery code<input name="code" required /></label><div className="actions"><button className="btn danger">Confirm disable</button><button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button></div></form>}</div>;
}

function OrganizationControls({ data, action, setMessage }: any) {
  const [name, setName] = useState(data.organization?.name || "");
  return <article className="record"><p className="eyebrow">Organization profile</p><h3>Enterprise workspace identity</h3><form className="form" onSubmit={async event => { event.preventDefault(); const result = await action("organization_profile", { name }); if (result) setMessage("Organization profile updated."); }}><label>Organization name<input value={name} onChange={event => setName(event.target.value)} required /></label><button className="btn gold">Save organization</button></form></article>;
}

function UserControls({ data, action, setMessage }: any) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [vesselIds, setVesselIds] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);

  return <section style={{ display: "grid", gap: 14 }}>
    <article className="record"><p className="eyebrow">Organization users</p><h3>Invite verified operators</h3><form className="form" onSubmit={async event => { event.preventDefault(); const result = await action("invite_user", { email: inviteEmail, role: inviteRole, vesselIds, canEditVessels: canEdit }); if (result) { setInviteEmail(""); setVesselIds([]); setMessage("Secure invitation sent."); } }}><label>Email<input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} /></label><label>Role<select value={inviteRole} onChange={event => setInviteRole(event.target.value)}>{ROLES.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>{!['fleet_manager','org_admin'].includes(inviteRole) && <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}><legend>Vessel access</legend>{(data.vessels || []).length ? (data.vessels || []).map((vessel: any) => <label key={vessel.id} style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={vesselIds.includes(vessel.id)} onChange={event => setVesselIds(current => event.target.checked ? [...current, vessel.id] : current.filter(id => id !== vessel.id))} />{vessel.name}{vessel.imo ? ` · ${vessel.imo}` : ""}</label>) : <p className="muted">Add a vessel before assigning vessel-scoped operators.</p>}<label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}><input type="checkbox" checked={canEdit} onChange={event => setCanEdit(event.target.checked)} />Allow edits on assigned vessels</label></fieldset>}<button className="btn gold">Send secure invitation</button></form></article>

    <div className="record-grid">{(data.users || []).map((user: any) => <UserCard key={user.id} user={user} vessels={data.vessels || []} action={action} setMessage={setMessage} />)}</div>
    {(data.invitations || []).filter((invite: any) => !invite.accepted_at && !invite.revoked_at).length > 0 && <article className="record"><p className="eyebrow">Pending invitations</p><div className="data-grid"><table><thead><tr><th>Email</th><th>Role</th><th>Expires</th><th>Action</th></tr></thead><tbody>{data.invitations.filter((invite: any) => !invite.accepted_at && !invite.revoked_at).map((invite: any) => <tr key={invite.id}><td>{invite.email}</td><td>{roleLabel(invite.role)}</td><td>{when(invite.expires_at)}</td><td><button className="btn danger" onClick={async () => { const result = await action("revoke_invitation", { invitationId: invite.id }); if (result) setMessage("Invitation revoked."); }}>Revoke</button></td></tr>)}</tbody></table></div></article>}
  </section>;
}

function UserCard({ user, vessels, action, setMessage }: any) {
  const initialIds = useMemo(() => (user.vessel_permissions || []).map((item: any) => String(item.vesselId)), [user.vessel_permissions]);
  const [role, setRole] = useState(user.role);
  const [ids, setIds] = useState<string[]>(initialIds);
  const [canEdit, setCanEdit] = useState(Boolean((user.vessel_permissions || []).some((item: any) => item.canEdit)));
  const unrestricted = ["admin", "owner", "fleet_manager", "org_admin"].includes(role);
  return <article className="record"><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><h3>{user.name}</h3><p className="muted">{user.email}</p></div><span className={`status ${user.is_active ? "configured" : ""}`}>{user.is_active ? "Active" : "Disabled"}</span></div><p>Email verified: <b>{user.email_verified_at ? "Yes" : "No"}</b> · MFA: <b>{user.mfa_enabled ? "On" : "Off"}</b></p><label>Role<select value={role} onChange={event => setRole(event.target.value)}>{user.role === "admin" && <option value="admin">Organization creator</option>}{user.role === "owner" && <option value="owner">Owner</option>}{ROLES.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>{!unrestricted && <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, marginTop: 10 }}><legend>Assigned vessels</legend>{vessels.map((vessel: any) => <label key={vessel.id} style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={ids.includes(vessel.id)} onChange={event => setIds(current => event.target.checked ? [...current, vessel.id] : current.filter(id => id !== vessel.id))} />{vessel.name}</label>)}<label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}><input type="checkbox" checked={canEdit} onChange={event => setCanEdit(event.target.checked)} />Can edit assigned vessel records</label></fieldset>}<div className="actions" style={{ marginTop: 12 }}><button className="btn" onClick={async () => { const result = await action("update_user", { userId: user.id, role, vesselIds: unrestricted ? [] : ids, canEditVessels: canEdit }); if (result) setMessage("User access updated."); }}>Save access</button><button className={`btn ${user.is_active ? "danger" : ""}`} onClick={async () => { const result = await action("update_user", { userId: user.id, isActive: !user.is_active }); if (result) setMessage(user.is_active ? "User deactivated and active sessions revoked." : "User reactivated."); }}>{user.is_active ? "Deactivate" : "Reactivate"}</button></div></article>;
}

function DeviceControls({ data, action, setMessage }: any) {
  return <article className="record"><p className="eyebrow">Offline operations center</p><h3>Managed vessel devices</h3><p className="muted">Devices register after an authenticated online load. Revocation blocks future authenticated use; wipe requests clear Neptune offline data when the device next reaches the service.</p><div className="data-grid"><table><thead><tr><th>Device</th><th>User</th><th>Offline</th><th>GPS</th><th>Queue</th><th>Last sync</th><th>Last seen</th><th>Status</th><th>Controls</th></tr></thead><tbody>{(data.devices || []).map((device: any) => <tr key={device.id}><td>{device.label || device.platform || "Neptune device"}</td><td>{device.user_email || "—"}</td><td>{device.offline_capable ? "Ready" : "No"}</td><td>{device.gps_permission || "unknown"}</td><td>{device.queue_depth || 0}</td><td>{when(device.last_sync_at)}</td><td>{when(device.last_seen_at)}</td><td>{device.revoked_at ? "Revoked" : device.wipe_requested_at ? "Wipe pending" : "Active"}</td><td><div className="actions">{device.revoked_at ? <button className="btn" onClick={() => action("device_action", { deviceId: device.id, deviceAction: "restore" })}>Restore</button> : <button className="btn danger" onClick={async () => { const result = await action("device_action", { deviceId: device.id, deviceAction: "revoke" }); if (result) setMessage("Device revoked."); }}>Revoke</button>}{device.wipe_requested_at ? <button className="btn" onClick={() => action("device_action", { deviceId: device.id, deviceAction: "clear_wipe" })}>Cancel wipe</button> : <button className="btn danger" onClick={async () => { if (!window.confirm("Request deletion of Neptune offline data from this device when it next connects?")) return; const result = await action("device_action", { deviceId: device.id, deviceAction: "wipe" }); if (result) setMessage("Remote wipe request queued."); }}>Request wipe</button>}</div></td></tr>)}</tbody></table></div>{!(data.devices || []).length && <p className="muted">No authenticated devices have registered yet.</p>}</article>;
}

function AuditControls({ events }: { events: any[] }) {
  return <article className="record"><p className="eyebrow">Immutable audit center</p><h3>Append-only organization evidence</h3><p className="muted">Audit events cannot be edited or deleted through Neptune and are protected by a database mutation-blocking trigger.</p><div className="data-grid"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Source</th><th>Result</th></tr></thead><tbody>{events.map(event => <tr key={event.id}><td>{when(event.created_at)}</td><td>{event.user_email || "System"}</td><td>{event.action}</td><td>{event.entity_type || "—"}{event.entity_id ? ` · ${event.entity_id}` : ""}</td><td>{event.source}</td><td>{event.success ? "Success" : "Denied/failed"}</td></tr>)}</tbody></table></div>{!events.length && <p className="muted">Audit events will appear as protected actions occur.</p>}</article>;
}
