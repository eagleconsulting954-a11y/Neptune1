import { spawn } from "node:child_process";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;
const port = 3382;
const base = `http://127.0.0.1:${port}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for CRM integration tests");

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: base,
    AUTH_SECRET: process.env.AUTH_SECRET || "ci-crm-e2e-secret-neptune",
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

function assert(name, condition, detail = "assertion failed") {
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
  throw new Error(`Neptune CRM test server did not start.\n${serverOutput}`);
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
    body: JSON.stringify({ email, password, from: "/admin", deviceLabel: "CRM CI" }),
    redirect: "manual"
  });
  const result = await response.json().catch(() => ({}));
  assert(`login ${email}`, response.status === 200, `${response.status}: ${JSON.stringify(result)}`);
  return cookiesFrom(response);
}

async function request(path, { cookie, method = "GET", body } = {}) {
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
const orgId = `org_crm_ci_${stamp}`;
const ownerId = `usr_crm_owner_${stamp}`;
const managerId = `usr_crm_manager_${stamp}`;
const managerEmail = `crm-manager-${stamp}@example.test`;
const password = "EnterpriseCrmTest123!";
const hash = await bcrypt.hash(password, 10);
const client = new Client({ connectionString: databaseUrl, ssl: false });

try {
  await waitForServer();
  await client.connect();

  await client.query("insert into organizations(id,name,plan,status) values($1,$2,'full_vessel_access','active')", [orgId, "CRM CI Fleet"]);
  await client.query(`
    insert into users(id,org_id,name,email,password_hash,role,email_verified_at,is_active)
    values($1,$2,'CRM Owner','francis@canalclear.org',$3,'owner',now(),true),
          ($4,$2,'CRM Manager',$5,$3,'fleet_manager',now(),true)
  `, [ownerId, orgId, hash, managerId, managerEmail]);
  await client.query("insert into subscriptions(id,org_id,customer_id,subscription_id,plan,status,current_period_end) values($1,$2,null,null,'full_vessel_access','active',null)", [`sub_crm_ci_${stamp}`, orgId]);

  const ownerCookie = await login("francis@canalclear.org", password);
  const managerCookie = await login(managerEmail, password);

  let call = await request("/api/v1/admin/crm", {
    cookie: managerCookie,
    method: "POST",
    body: { company: "Denied Shipping", annual_value: 1 }
  });
  assert("non-designated manager cannot write CRM", call.response.status === 403, `received ${call.response.status}`);

  call = await request("/api/v1/admin/crm", {
    cookie: ownerCookie,
    method: "POST",
    body: {
      company: "Atlantic Fleet Group",
      contact: "Morgan Reed",
      contact_title: "VP Fleet Operations",
      email: "morgan@example.test",
      phone: "+1 555 010 9000",
      owner: "Francis",
      source: "Referral",
      stage: "Proposal",
      annual_value: 240000,
      currency: "USD",
      probability: 65,
      expected_close_at: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
      next_action: "Review enterprise proposal",
      next_action_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      last_contact_at: new Date().toISOString(),
      notes: "CI-only opportunity; deleted before test completion."
    }
  });
  assert("full CRM opportunity creates", call.response.status === 201, JSON.stringify(call.result));
  const firstId = call.result.item?.id;
  assert("extended CRM fields persist", call.result.item?.contact_title === "VP Fleet Operations" && call.result.item?.owner === "Francis" && Number(call.result.item?.probability) === 65, JSON.stringify(call.result.item));

  call = await request("/api/v1/admin/analytics", { cookie: ownerCookie });
  assert("admin CRM analytics loads", call.response.status === 200, `${call.response.status}: ${JSON.stringify(call.result)}`);
  assert("active pipeline excludes closed deals", Number(call.result.summary?.pipeline) === 240000, JSON.stringify(call.result.summary));
  assert("weighted pipeline uses probability", Number(call.result.summary?.weightedPipeline) === 156000, JSON.stringify(call.result.summary));
  assert("forecast includes dated opportunity", Number(call.result.summary?.closing30Days) === 1 && Number(call.result.forecast?.[0]?.value) === 240000, JSON.stringify(call.result.forecast));

  call = await request("/api/v1/admin/crm", { cookie: ownerCookie, method: "PATCH", body: { id: firstId, stage: "Negotiation" } });
  assert("stage transition persists", call.response.status === 200 && call.result.item?.stage === "Negotiation", JSON.stringify(call.result));
  assert("stage transition recalculates default probability", Number(call.result.item?.probability) === 80, JSON.stringify(call.result.item));

  call = await request("/api/v1/admin/crm", { cookie: ownerCookie, method: "PATCH", body: { id: firstId, last_contact_at: new Date().toISOString(), next_action: "Confirm procurement decision" } });
  assert("contact and next action update", call.response.status === 200 && call.result.item?.next_action === "Confirm procurement decision", JSON.stringify(call.result));

  call = await request("/api/v1/admin/crm", { cookie: ownerCookie, method: "PATCH", body: { id: firstId, stage: "Won" } });
  assert("won transition forces 100 percent probability", call.response.status === 200 && Number(call.result.item?.probability) === 100, JSON.stringify(call.result));

  call = await request("/api/v1/admin/crm", {
    cookie: ownerCookie,
    method: "POST",
    body: { company: "Pacific Chartering", stage: "Lost", annual_value: 100000, lost_reason: "Procurement timing" }
  });
  assert("lost opportunity creates with zero probability", call.response.status === 201 && Number(call.result.item?.probability) === 0, JSON.stringify(call.result));
  const lostId = call.result.item?.id;

  call = await request("/api/v1/admin/analytics", { cookie: ownerCookie });
  assert("closed opportunities do not inflate active pipeline", Number(call.result.summary?.pipeline) === 0 && Number(call.result.summary?.wonValue) === 240000 && Number(call.result.summary?.lostValue) === 100000, JSON.stringify(call.result.summary));
  assert("conversion rate derives from won and lost", Number(call.result.summary?.conversionRate) === 50, JSON.stringify(call.result.summary));

  call = await request("/api/v1/admin/crm", { cookie: ownerCookie, method: "POST", body: { company: "Invalid Email Co", email: "not-an-email" } });
  assert("CRM validation rejects invalid email", call.response.status === 400, `received ${call.response.status}`);

  const audit = await client.query("select action from audit_events where org_id=$1 and entity_type='crm_accounts' order by created_at", [orgId]);
  const actions = audit.rows.map(row => row.action);
  assert("CRM audit records creation", actions.includes("crm.opportunity_created"), JSON.stringify(actions));
  assert("CRM audit records stage changes", actions.includes("crm.stage_changed"), JSON.stringify(actions));
  assert("CRM audit records updates", actions.includes("crm.opportunity_updated"), JSON.stringify(actions));

  call = await request(`/api/v1/admin/crm?id=${encodeURIComponent(firstId)}`, { cookie: ownerCookie, method: "DELETE" });
  assert("CRM opportunity deletes", call.response.status === 200 && call.result.ok === true, JSON.stringify(call.result));
  call = await request(`/api/v1/admin/crm?id=${encodeURIComponent(lostId)}`, { cookie: ownerCookie, method: "DELETE" });
  assert("second CRM opportunity deletes", call.response.status === 200 && call.result.ok === true, JSON.stringify(call.result));

  const remaining = await client.query("select count(*)::int as count from crm_accounts where org_id=$1", [orgId]);
  assert("CRM test records fully removed", Number(remaining.rows[0]?.count || 0) === 0, JSON.stringify(remaining.rows));

  console.log("Neptune CRM database-backed integration tests passed.");
} finally {
  try { await client.query("delete from organizations where id=$1", [orgId]); } catch {}
  try { await client.end(); } catch {}
  child.kill("SIGTERM");
  await new Promise(resolve => setTimeout(resolve, 300));
  if (!child.killed) child.kill("SIGKILL");
}
