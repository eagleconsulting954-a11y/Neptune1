import { spawn } from "node:child_process";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;
const port = 3392;
const base = `http://127.0.0.1:${port}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for AI governance integration tests");

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: base,
    AUTH_SECRET: process.env.AUTH_SECRET || "ci-ai-governance-e2e-secret-neptune",
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
  throw new Error(`Neptune AI governance test server did not start.\n${serverOutput}`);
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
    headers: { "content-type": "application/json", origin: base, "sec-fetch-site": "same-origin" },
    body: JSON.stringify({ email, password, from: "/ai-governance", deviceLabel: "AI Governance CI" }),
    redirect: "manual"
  });
  const result = await response.json().catch(() => ({}));
  assert(`login ${email}`, response.status === 200, `${response.status}: ${JSON.stringify(result)}`);
  return cookiesFrom(response);
}

async function request(path, { cookie, method = "GET", body } = {}) {
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(mutation ? { origin: base, "sec-fetch-site": "same-origin" } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual"
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

const stamp = Date.now().toString(36);
const orgId = `org_ai_gov_ci_${stamp}`;
const ownerId = `usr_ai_gov_owner_${stamp}`;
const secondaryId = `usr_ai_gov_secondary_${stamp}`;
const managerId = `usr_ai_gov_manager_${stamp}`;
const managerEmail = `ai-gov-manager-${stamp}@example.test`;
const password = "EnterpriseAiGovernanceTest123!";
const hash = await bcrypt.hash(password, 10);
const client = new Client({ connectionString: databaseUrl, ssl: false });
let decisionId = "";
let evaluationId = "";

try {
  await waitForServer();
  await client.connect();

  await client.query("insert into organizations(id,name,plan,status) values($1,$2,'full_vessel_access','active')", [orgId, "AI Governance CI Fleet"]);
  await client.query(`
    insert into users(id,org_id,name,email,password_hash,role,email_verified_at,is_active)
    values($1,$2,'AI Governance Owner','francis@canalclear.org',$3,'owner',now(),true),
          ($4,$2,'AI Governance Secondary','rajput.jaspal@yahoo.in',$3,'org_admin',now(),true),
          ($5,$2,'AI Governance Manager',$6,$3,'fleet_manager',now(),true)
  `, [ownerId, orgId, hash, secondaryId, managerId, managerEmail]);
  await client.query(
    "insert into subscriptions(id,org_id,stripe_customer_id,stripe_subscription_id,plan,status,current_period_end) values($1,$2,null,null,'full_vessel_access','active',null)",
    [`sub_ai_gov_ci_${stamp}`, orgId]
  );

  const ownerCookie = await login("francis@canalclear.org", password);
  const secondaryCookie = await login("rajput.jaspal@yahoo.in", password);
  const managerCookie = await login(managerEmail, password);

  let call = await request("/api/v1/admin/ai-governance", { cookie: managerCookie });
  assert("non-designated manager cannot read AI governance", call.response.status === 403, `received ${call.response.status}`);

  call = await request("/api/v1/admin/ai-governance", {
    cookie: ownerCookie,
    method: "POST",
    body: {
      action: "system.create",
      input: {
        name: "Voyage Risk Intelligence CI",
        module: "Maritime Intel",
        purpose: "CI-only governed maritime recommendation system.",
        provider: "CI Provider",
        model_version: "ci-model-1",
        prompt_version: "ci-prompt-1",
        risk_tier: "High",
        authority_level: "Recommend",
        owner: "Fleet Operations",
        environment: "Test",
        status: "Approved",
        data_access: "AIS, weather, vessel profile",
        human_approval_required: true,
        assurance_score: 88,
        next_review_at: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      }
    }
  });
  assert("designated owner can register AI system", call.response.status === 201, JSON.stringify(call.result));
  const systemId = call.result.item?.id;
  assert("AI system fields persist", systemId && call.result.item?.risk_tier === "High" && call.result.item?.authority_level === "Recommend" && call.result.item?.human_approval_required === true, JSON.stringify(call.result.item));

  call = await request("/api/v1/admin/ai-governance", { cookie: secondaryCookie });
  assert("secondary designated admin sees AI registry", call.response.status === 200 && call.result.systems?.some(item => item.id === systemId), JSON.stringify(call.result));

  call = await request("/api/v1/admin/ai-governance", {
    cookie: secondaryCookie,
    method: "POST",
    body: {
      action: "control.upsert",
      input: {
        system_id: systemId,
        layer_key: "inventory",
        control_name: "Shadow AI Detection",
        status: "Implemented",
        owner: "Fleet Operations",
        evidence: "CI evidence: approved AI inventory review completed.",
        last_reviewed_at: new Date().toISOString().slice(0, 10)
      }
    }
  });
  assert("secondary admin can assess governance control", call.response.status === 200 && call.result.item?.status === "Implemented", JSON.stringify(call.result));

  call = await request("/api/v1/admin/ai-governance", {
    cookie: ownerCookie,
    method: "POST",
    body: {
      action: "finding.create",
      input: {
        system_id: systemId,
        layer_key: "model_assurance",
        severity: "Critical",
        status: "Open",
        title: "CI red-team evidence gap",
        description: "CI-only governance finding.",
        owner: "AI Governance"
      }
    }
  });
  assert("critical governance finding creates", call.response.status === 201 && call.result.item?.severity === "Critical", JSON.stringify(call.result));
  const findingId = call.result.item?.id;

  call = await request("/api/v1/admin/ai-governance", {
    cookie: secondaryCookie,
    method: "PATCH",
    body: { action: "finding.update", id: findingId, input: { status: "In progress" } }
  });
  assert("secondary admin can progress governance finding", call.response.status === 200 && call.result.item?.status === "In progress", JSON.stringify(call.result));

  call = await request("/api/v1/admin/ai-governance", {
    cookie: ownerCookie,
    method: "POST",
    body: {
      action: "evaluation.record",
      input: {
        system_id: systemId,
        evaluation_type: "Maritime hallucination benchmark",
        score: 94,
        status: "Completed",
        notes: "CI-only model assurance evidence.",
        reviewed_by: "AI Governance CI"
      }
    }
  });
  assert("assurance evaluation records", call.response.status === 201 && Number(call.result.item?.score) === 94, JSON.stringify(call.result));
  evaluationId = call.result.item?.id || "";

  call = await request("/api/v1/admin/ai-governance", {
    cookie: ownerCookie,
    method: "POST",
    body: {
      action: "decision.record",
      input: {
        system_id: systemId,
        model_version: "ci-model-1",
        prompt_version: "ci-prompt-1",
        authority_level: "Recommend",
        input_sources: ["AIS", "Weather", "Vessel profile"],
        output_summary: "Recommend route-risk review before operator action.",
        confidence: 91,
        policy_result: "Human approval required.",
        human_reviewer: "Fleet Operations",
        override_status: "Accepted",
        final_action: "Human reviewer accepted advisory recommendation."
      }
    }
  });
  assert("AI decision evidence records", call.response.status === 201 && Number(call.result.item?.confidence) === 91, JSON.stringify(call.result));
  decisionId = call.result.item?.id || "";

  call = await request("/api/v1/admin/ai-governance", { cookie: ownerCookie });
  assert("governance control plane loads persisted records", call.response.status === 200, `${call.response.status}: ${JSON.stringify(call.result)}`);
  assert("governance summary counts high-risk system", Number(call.result.summary?.highRisk) === 1, JSON.stringify(call.result.summary));
  assert("governance summary counts open critical finding", Number(call.result.summary?.openFindings) === 1 && Number(call.result.summary?.criticalFindings) === 1, JSON.stringify(call.result.summary));
  assert("evaluation updates system assurance score", call.result.systems?.find(item => item.id === systemId)?.assurance_score === 94, JSON.stringify(call.result.systems));
  assert("decision evidence is visible", call.result.decisions?.some(item => item.id === decisionId), JSON.stringify(call.result.decisions));

  call = await request(`/api/v1/admin/ai-governance?id=${encodeURIComponent(systemId)}`, { cookie: ownerCookie, method: "DELETE" });
  assert("system with governance evidence cannot be deleted", call.response.status === 409, `${call.response.status}: ${JSON.stringify(call.result)}`);

  let decisionMutationRejected = false;
  try { await client.query("delete from ai_decision_records where id=$1", [decisionId]); } catch { decisionMutationRejected = true; }
  assert("AI decision evidence is database-immutable", decisionMutationRejected);

  let evaluationMutationRejected = false;
  try { await client.query("update ai_assurance_evaluations set score=1 where id=$1", [evaluationId]); } catch { evaluationMutationRejected = true; }
  assert("assurance evaluation evidence is database-immutable", evaluationMutationRejected);

  call = await request("/api/v1/admin/ai-governance", {
    cookie: secondaryCookie,
    method: "PATCH",
    body: { action: "system.update", id: systemId, input: { status: "Retired" } }
  });
  assert("governed system can be retired without deleting evidence", call.response.status === 200 && call.result.item?.status === "Retired", JSON.stringify(call.result));

  const audit = await client.query("select action from audit_events where org_id=$1 and action like 'ai_governance.%' order by created_at", [orgId]);
  const actions = audit.rows.map(row => row.action);
  assert("AI governance audit records registry creation", actions.includes("ai_governance.system_created"), JSON.stringify(actions));
  assert("AI governance audit records control assessment", actions.includes("ai_governance.control_assessed"), JSON.stringify(actions));
  assert("AI governance audit records decision evidence", actions.includes("ai_governance.decision_recorded"), JSON.stringify(actions));

  console.log("Neptune AI governance database-backed integration tests passed.");
} finally {
  try {
    await client.query("alter table ai_decision_records disable trigger trg_neptune_ai_decision_immutable");
    await client.query("alter table ai_assurance_evaluations disable trigger trg_neptune_ai_evaluation_immutable");
    await client.query("delete from organizations where id=$1", [orgId]);
  } catch {}
  try { await client.end(); } catch {}
  child.kill("SIGTERM");
  await new Promise(resolve => setTimeout(resolve, 300));
  if (!child.killed) child.kill("SIGKILL");
}
