import { spawn } from "node:child_process";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;
const port = 3381;
const base = `http://127.0.0.1:${port}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for enterprise integration tests");

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: base,
    AUTH_SECRET: process.env.AUTH_SECRET || "ci-enterprise-e2e-secret-neptune",
    DATABASE_URL: databaseUrl,
    PG_SSL_REJECT_UNAUTHORIZED: "false",
    ALLOW_DEMO_LOGIN: "false",
    RESEND_API_KEY: ""
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let serverOutput = "";
child.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
child.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

function assert(name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  console.log(`✓ ${name}`);
}

async function waitForServer() {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`, { cache: "no-store" });
      if (response.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error(`Neptune enterprise test server did not start.\n${serverOutput}`);
}

function cookiesFrom(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map(value => value.split(";", 1)[0]).join("; ");
}

async function login(email, password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, from: "/dashboard", deviceLabel: "CI vessel device" }),
    redirect: "manual"
  });
  const body = await response.json().catch(() => ({}));
  assert(`login ${email}`, response.status === 200, `expected 200, received ${response.status}: ${JSON.stringify(body)}`);
  const cookie = cookiesFrom(response);
  assert(`session cookie ${email}`, cookie.includes("neptune_session_v2=") && cookie.includes("neptune_access_v1="), `missing session/access cookies: ${cookie}`);
  return cookie;
}

async function jsonRequest(path, { cookie, method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual"
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

const stamp = Date.now().toString(36);
const ids = {
  alphaOrg: `org_ci_alpha_${stamp}`,
  betaOrg: `org_ci_beta_${stamp}`,
  captainOrg: `org_ci_captain_${stamp}`,
  alphaManager: `usr_ci_manager_${stamp}`,
  alphaScoped: `usr_ci_scoped_${stamp}`,
  primary: `usr_ci_primary_${stamp}`,
  secondary: `usr_ci_secondary_${stamp}`,
  betaAdmin: `usr_ci_beta_${stamp}`,
  captainAdmin: `usr_ci_captain_${stamp}`,
  alpha1: `vsl_ci_alpha1_${stamp}`,
  alpha2: `vsl_ci_alpha2_${stamp}`,
  beta1: `vsl_ci_beta1_${stamp}`,
  captain1: `vsl_ci_captain_${stamp}`,
  crm: `crm_ci_${stamp}`,
  incidentAlpha2: `inc_ci_alpha2_${stamp}`
};
const password = "EnterpriseTestPass123!";
const passwordHash = await bcrypt.hash(password, 10);
const client = new Client({ connectionString: databaseUrl, ssl: false });

try {
  await waitForServer();
  await client.connect();

  await client.query("insert into organizations(id,name,plan,status) values($1,$2,$3,$4),($5,$6,$7,$8),($9,$10,$11,$12)", [
    ids.alphaOrg, "CI Alpha Fleet", "full_vessel_access", "active",
    ids.betaOrg, "CI Beta Fleet", "full_vessel_access", "active",
    ids.captainOrg, "CI Captain Fleet", "captain", "active"
  ]);

  await client.query(`
    insert into users(id,org_id,name,email,password_hash,role,email_verified_at,is_active)
    values
      ($1,$2,$3,$4,$5,$6,now(),true),
      ($7,$8,$9,$10,$11,$12,now(),true),
      ($13,$14,$15,$16,$17,$18,now(),true),
      ($19,$20,$21,$22,$23,$24,now(),true),
      ($25,$26,$27,$28,$29,$30,now(),true),
      ($31,$32,$33,$34,$35,$36,now(),true)
  `, [
    ids.primary, ids.alphaOrg, "Francis Eagleston", "francis@canalclear.org", passwordHash, "owner",
    ids.secondary, ids.alphaOrg, "Jaspal Rajput", "rajput.jaspal@yahoo.in", passwordHash, "org_admin",
    ids.alphaManager, ids.alphaOrg, "Alpha Fleet Manager", `manager-${stamp}@alpha.test`, passwordHash, "fleet_manager",
    ids.alphaScoped, ids.alphaOrg, "Alpha Scoped Operator", `scoped-${stamp}@alpha.test`, passwordHash, "member",
    ids.betaAdmin, ids.betaOrg, "Beta Manager", `admin-${stamp}@beta.test`, passwordHash, "admin",
    ids.captainAdmin, ids.captainOrg, "Captain Plan Admin", `captain-${stamp}@gamma.test`, passwordHash, "admin"
  ]);

  await client.query(`
    insert into subscriptions(id,org_id,customer_id,subscription_id,plan,status,current_period_end)
    values
      ($1,$2,null,null,'full_vessel_access','active',null),
      ($3,$4,null,null,'full_vessel_access','active',null),
      ($5,$6,null,null,'captain','active',null)
  `, [`sub_ci_alpha_${stamp}`, ids.alphaOrg, `sub_ci_beta_${stamp}`, ids.betaOrg, `sub_ci_captain_${stamp}`, ids.captainOrg]);

  await client.query(`
    insert into vessels(id,org_id,name,vessel_type,imo,status,readiness,eta)
    values
      ($1,$2,'Alpha One','Container','IMO9000001','En route',88,'Test ETA'),
      ($3,$4,'Alpha Two','Tanker','IMO9000002','In port',77,'Test ETA'),
      ($5,$6,'Beta One','Bulk','IMO9000003','At anchor',66,'Test ETA'),
      ($7,$8,'Captain One','Tug','IMO9000004','In port',91,'Test ETA')
  `, [ids.alpha1, ids.alphaOrg, ids.alpha2, ids.alphaOrg, ids.beta1, ids.betaOrg, ids.captain1, ids.captainOrg]);

  await client.query("insert into user_vessel_permissions(user_id,vessel_id,org_id,can_view,can_edit) values($1,$2,$3,true,true)", [ids.alphaScoped, ids.alpha1, ids.alphaOrg]);
  await client.query("insert into incidents(id,org_id,vessel_id,title,severity,status,owner) values($1,$2,$3,'Alpha Two private incident','High','Open','Safety Officer')", [ids.incidentAlpha2, ids.alphaOrg, ids.alpha2]);
  await client.query("insert into crm_accounts(id,org_id,company,contact,email,stage,annual_value) values($1,$2,'CI Shipping','Test Contact','contact@example.test','Qualified',125000)", [ids.crm, ids.alphaOrg]);

  const scopedEmail = `scoped-${stamp}@alpha.test`;
  const scopedCookie = await login(scopedEmail, password);
  let result = await jsonRequest("/api/v1/dashboard", { cookie: scopedCookie });
  assert("scoped dashboard loads", result.response.status === 200, `received ${result.response.status}`);
  assert("scoped dashboard has one assigned vessel", result.result.vessels?.length === 1 && result.result.vessels[0].id === ids.alpha1, JSON.stringify(result.result.vessels));
  assert("scoped dashboard hides organization activity", Array.isArray(result.result.events) && result.result.events.length === 0, JSON.stringify(result.result.events));
  assert("scoped dashboard hides billing", Array.isArray(result.result.subscriptions) && result.result.subscriptions.length === 0, JSON.stringify(result.result.subscriptions));
  assert("scoped dashboard hides fleet-wide trend", result.result.insights?.trend?.points?.length === 0, JSON.stringify(result.result.insights?.trend));
  assert("scoped dashboard strips activity/billing modules", !result.result.entitlement?.access?.modules?.includes("activity") && !result.result.entitlement?.access?.modules?.includes("billing"), JSON.stringify(result.result.entitlement?.access?.modules));

  result = await jsonRequest("/api/v1/vessels", { cookie: scopedCookie });
  assert("vessel API scopes rows", result.response.status === 200 && result.result.items?.length === 1 && result.result.items[0].id === ids.alpha1, JSON.stringify(result.result));

  result = await jsonRequest("/api/v1/activity_events", { cookie: scopedCookie });
  assert("scoped operator cannot read organization activity", result.response.status === 403, `received ${result.response.status}`);
  result = await jsonRequest("/api/v1/subscriptions", { cookie: scopedCookie });
  assert("scoped operator cannot read billing records", result.response.status === 403, `received ${result.response.status}`);
  result = await jsonRequest("/api/v1/crm_accounts", { cookie: scopedCookie });
  assert("scoped operator cannot read CRM", result.response.status === 403, `received ${result.response.status}`);

  result = await jsonRequest("/api/v1/incidents", {
    cookie: scopedCookie,
    method: "POST",
    body: { vessel_id: ids.alpha1, title: "Scoped incident", severity: "Normal", status: "Open", owner: "Safety Officer" }
  });
  assert("scoped operator can write assigned vessel", result.response.status === 201, JSON.stringify(result.result));
  const scopedIncidentId = result.result.item?.id;

  result = await jsonRequest("/api/v1/incidents", {
    cookie: scopedCookie,
    method: "POST",
    body: { vessel_id: ids.alpha2, title: "Unauthorized incident", severity: "High", status: "Open", owner: "Safety Officer" }
  });
  assert("scoped operator cannot write unassigned vessel", result.response.status === 403, `received ${result.response.status}`);

  result = await jsonRequest("/api/v1/emergency-events", {
    cookie: scopedCookie,
    method: "POST",
    body: { vessel_id: ids.alpha1, status: "active", started_at: new Date().toISOString(), device_id: "ci-device" }
  });
  assert("emergency event allowed on assigned vessel", result.response.status === 201, JSON.stringify(result.result));
  const emergencyId = result.result.item?.id;

  result = await jsonRequest("/api/v1/emergency-events", {
    cookie: scopedCookie,
    method: "POST",
    body: { vessel_id: ids.alpha2, status: "active", started_at: new Date().toISOString(), device_id: "ci-device" }
  });
  assert("emergency event denied on unassigned vessel", result.response.status === 403, `received ${result.response.status}`);

  result = await jsonRequest("/api/v1/emergency-positions/batch", {
    cookie: scopedCookie,
    method: "POST",
    body: {
      event_id: emergencyId,
      positions: [{ id: `gps_${stamp}01`, sequence_number: 1, latitude: 25.1, longitude: -75.2, accuracy_m: 8, speed_knots: 4.5, heading_deg: 120, recorded_at: new Date().toISOString() }]
    }
  });
  assert("offline emergency GPS batch accepted for assigned vessel", result.response.status === 200 && result.result.inserted === 1, JSON.stringify(result.result));

  const betaCookie = await login(`admin-${stamp}@beta.test`, password);
  result = await jsonRequest("/api/v1/incidents", { cookie: betaCookie, method: "PATCH", body: { id: scopedIncidentId, status: "Closed" } });
  assert("tenant isolation blocks cross-organization record update", result.response.status === 404, `received ${result.response.status}`);

  const managerCookie = await login(`manager-${stamp}@alpha.test`, password);
  result = await jsonRequest("/api/v1/dashboard", { cookie: managerCookie });
  assert("organization manager sees full fleet", result.response.status === 200 && result.result.vessels?.length === 2, JSON.stringify(result.result.vessels));
  assert("ordinary organization manager still has no CRM", result.result.adminAccess === false && result.result.crm?.length === 0, JSON.stringify({ adminAccess: result.result.adminAccess, crm: result.result.crm }));
  result = await jsonRequest("/api/v1/crm_accounts", { cookie: managerCookie });
  assert("organization manager cannot access CRM", result.response.status === 403, `received ${result.response.status}`);

  const secondaryCookie = await login("rajput.jaspal@yahoo.in", password);
  result = await jsonRequest("/api/v1/dashboard", { cookie: secondaryCookie });
  assert("secondary designated admin receives admin identity access", result.response.status === 200 && result.result.adminAccess === true && result.result.crm?.length === 1, JSON.stringify({ adminAccess: result.result.adminAccess, crmCount: result.result.crm?.length }));
  result = await jsonRequest("/api/v1/crm_accounts", { cookie: secondaryCookie });
  assert("secondary designated admin CRM API access", result.response.status === 200 && result.result.items?.length === 1, JSON.stringify(result.result));

  const primaryCookie = await login("francis@canalclear.org", password);
  result = await jsonRequest("/api/v1/dashboard", { cookie: primaryCookie });
  assert("primary designated admin receives admin identity access", result.response.status === 200 && result.result.adminAccess === true, JSON.stringify(result.result));
  result = await jsonRequest("/api/v1/crm_accounts", { cookie: primaryCookie });
  assert("primary designated admin CRM API access", result.response.status === 200 && result.result.items?.length === 1, JSON.stringify(result.result));

  const captainCookie = await login(`captain-${stamp}@gamma.test`, password);
  result = await jsonRequest("/api/v1/security-center", {
    cookie: captainCookie,
    method: "POST",
    body: { action: "invite_user", email: `new-admin-${stamp}@gamma.test`, role: "org_admin", vesselIds: [] }
  });
  assert("Captain package administrator-seat limit enforced", result.response.status === 403 && String(result.result.error || "").includes("administrator"), JSON.stringify(result.result));

  const audit = await client.query("select action,entity_id from audit_events where org_id=$1 and action in ('incidents.created','emergency.event_created','emergency.positions_synced')", [ids.alphaOrg]);
  assert("material vessel and emergency actions append audit evidence", audit.rows.length >= 3, JSON.stringify(audit.rows));

  const immutableTarget = audit.rows[0]?.entity_id;
  let mutationBlocked = false;
  if (immutableTarget) {
    const auditRow = await client.query("select id from audit_events where org_id=$1 limit 1", [ids.alphaOrg]);
    try {
      await client.query("update audit_events set action='tampered' where id=$1", [auditRow.rows[0].id]);
    } catch {
      mutationBlocked = true;
    }
  }
  assert("audit table rejects mutation", mutationBlocked, "audit UPDATE was not rejected by database trigger");

  const stripeWebhook = await fetch(`${base}/api/stripe/webhook`, { method: "POST", body: "{}" });
  assert("Stripe webhook fails closed when production secrets are absent", stripeWebhook.status === 503, `received ${stripeWebhook.status}`);

  console.log("Neptune database-backed enterprise integration tests passed.");
} finally {
  try { await client.end(); } catch {}
  child.kill("SIGTERM");
  await new Promise(resolve => setTimeout(resolve, 300));
  if (!child.killed) child.kill("SIGKILL");
}
