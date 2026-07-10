import { Pool } from "pg";

export type ResourceName = "vessels" | "duties" | "work_orders" | "certificates" | "incidents" | "crm_accounts" | "activity_events" | "subscriptions";
export type Row = Record<string, any>;

let pool: Pool | null = null;

function database() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      max: 8
    });
  }
  return pool;
}

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const memory: Record<ResourceName, Row[]> = {
  vessels: [
    { id: "vsl_001", org_id: "org_demo", name: "MT Atlantic Pioneer", vessel_type: "Tanker", imo: "9040011", status: "En route", readiness: 92, eta: "Santos +38h", created_at: now() },
    { id: "vsl_002", org_id: "org_demo", name: "MV Pacific Meridian", vessel_type: "Container", imo: "9040012", status: "Voyage ops", readiness: 88, eta: "Singapore 4d", created_at: now() },
    { id: "vsl_003", org_id: "org_demo", name: "MT Aurora Spirit", vessel_type: "Product tanker", imo: "9040013", status: "At anchor", readiness: 81, eta: "Houston hold", created_at: now() }
  ],
  duties: [
    { id: "dty_001", org_id: "org_demo", vessel_id: "vsl_001", category: "Hot Work", title: "Hot work permit HW-104", owner: "Chief Officer", location: "Engine workshop", status: "Master approval", severity: "critical", due_at: "Today 16:00", created_at: now() },
    { id: "dty_002", org_id: "org_demo", vessel_id: "vsl_003", category: "Inspection", title: "Aux generator inspection", owner: "2nd Engineer", location: "Engine room", status: "Evidence needed", severity: "attention", due_at: "Tomorrow", created_at: now() },
    { id: "dty_003", org_id: "org_demo", vessel_id: "vsl_002", category: "Inspection", title: "Main deck safety round", owner: "Bosun", location: "Main deck", status: "Open", severity: "normal", due_at: "Today 18:00", created_at: now() }
  ],
  work_orders: [
    { id: "wo_001", org_id: "org_demo", vessel_id: "vsl_003", title: "Aux generator cooling leak", owner: "Chief Engineer", status: "Parts pending", priority: "high", due_at: "Tomorrow", created_at: now() }
  ],
  certificates: [
    { id: "cert_001", org_id: "org_demo", vessel_id: "vsl_002", name: "IOPP Certificate", issuer: "Class Society", expires_at: "2026-08-01", status: "Expiring", created_at: now() }
  ],
  incidents: [
    { id: "inc_001", org_id: "org_demo", vessel_id: "vsl_001", title: "Near miss during stores transfer", severity: "low", status: "RCA open", owner: "Safety Officer", created_at: now() }
  ],
  crm_accounts: [
    { id: "crm_001", org_id: "org_demo", company: "Atlantic Bulk Lines", contact: "Maria Santos", email: "ops@atlantic.example", stage: "Demo booked", annual_value: 96000, created_at: now() },
    { id: "crm_002", org_id: "org_demo", company: "HarborBridge Logistics", contact: "David Chen", email: "fleet@harborbridge.example", stage: "Qualified", annual_value: 42000, created_at: now() }
  ],
  activity_events: [
    { id: "evt_001", org_id: "org_demo", label: "PTW #0047 submitted", body: "Awaiting Master signature", actor: "Chief Mate", created_at: now() },
    { id: "evt_002", org_id: "org_demo", label: "Certificate pack validated", body: "No blocking errors", actor: "System", created_at: now() }
  ],
  subscriptions: [
    { id: "sub_demo", org_id: "org_demo", stripe_customer_id: null, stripe_subscription_id: null, plan: "fleetops", status: "active", current_period_end: null, created_at: now() }
  ]
};

const resourceConfig: Record<ResourceName, { prefix: string; fields: string[] }> = {
  vessels: { prefix: "vsl", fields: ["name", "vessel_type", "imo", "status", "readiness", "eta"] },
  duties: { prefix: "dty", fields: ["vessel_id", "category", "title", "owner", "location", "status", "severity", "due_at"] },
  work_orders: { prefix: "wo", fields: ["vessel_id", "title", "owner", "status", "priority", "due_at"] },
  certificates: { prefix: "cert", fields: ["vessel_id", "name", "issuer", "expires_at", "status"] },
  incidents: { prefix: "inc", fields: ["vessel_id", "title", "severity", "status", "owner"] },
  crm_accounts: { prefix: "crm", fields: ["company", "contact", "email", "stage", "annual_value"] },
  activity_events: { prefix: "evt", fields: ["label", "body", "actor"] },
  subscriptions: { prefix: "sub", fields: ["stripe_customer_id", "stripe_subscription_id", "plan", "status", "current_period_end"] }
};

export async function ensureSchema() {
  const db = database();
  if (!db) return { ok: true, mode: "memory" };
  await db.query(`
    create table if not exists organizations (
      id text primary key,
      name text not null,
      plan text not null default 'trial',
      status text not null default 'trial',
      created_at timestamptz not null default now()
    );
    create table if not exists users (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      name text not null,
      email text unique not null,
      password_hash text not null,
      role text not null default 'member',
      created_at timestamptz not null default now()
    );
    create table if not exists vessels (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      name text not null,
      vessel_type text,
      imo text,
      status text,
      readiness int default 0,
      eta text,
      created_at timestamptz not null default now()
    );
    create table if not exists duties (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      vessel_id text references vessels(id) on delete set null,
      category text not null,
      title text not null,
      owner text,
      location text,
      status text not null default 'Open',
      severity text not null default 'normal',
      due_at text,
      created_at timestamptz not null default now()
    );
    create table if not exists work_orders (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      vessel_id text references vessels(id) on delete set null,
      title text not null,
      owner text,
      status text,
      priority text,
      due_at text,
      created_at timestamptz not null default now()
    );
    create table if not exists certificates (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      vessel_id text references vessels(id) on delete set null,
      name text not null,
      issuer text,
      expires_at text,
      status text,
      created_at timestamptz not null default now()
    );
    create table if not exists incidents (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      vessel_id text references vessels(id) on delete set null,
      title text not null,
      severity text,
      status text,
      owner text,
      created_at timestamptz not null default now()
    );
    create table if not exists crm_accounts (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      company text not null,
      contact text,
      email text,
      stage text,
      annual_value numeric default 0,
      created_at timestamptz not null default now()
    );
    create table if not exists activity_events (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      label text not null,
      body text,
      actor text,
      created_at timestamptz not null default now()
    );
    create table if not exists subscriptions (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      stripe_customer_id text,
      stripe_subscription_id text,
      plan text not null default 'fleetops',
      status text not null default 'inactive',
      current_period_end text,
      created_at timestamptz not null default now()
    );
    insert into organizations(id,name,plan,status) values('org_demo','Neptune Fleet Group','fleetops','active') on conflict (id) do nothing;
  `);
  return { ok: true, mode: "postgres" };
}

export async function sql<T extends Row = Row>(text: string, params: any[] = []): Promise<T[]> {
  const db = database();
  if (!db) return [];
  await ensureSchema();
  const result = await db.query(text, params);
  return result.rows as T[];
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function listResource(resource: ResourceName, orgId: string) {
  if (!database()) return memory[resource].filter(row => row.org_id === orgId);
  return sql(`select * from ${resource} where org_id=$1 order by created_at desc`, [orgId]);
}

export async function createResource(resource: ResourceName, orgId: string, input: Row) {
  const cfg = resourceConfig[resource];
  const row: Row = { id: uid(cfg.prefix), org_id: orgId, created_at: now() };
  for (const field of cfg.fields) row[field] = input[field] ?? null;
  if (!database()) {
    memory[resource].unshift(row);
    return row;
  }
  const fields = ["id", "org_id", ...cfg.fields];
  const values = fields.map(field => row[field]);
  const placeholders = fields.map((_, index) => `$${index + 1}`).join(",");
  const [created] = await sql(`insert into ${resource}(${fields.join(",")}) values(${placeholders}) returning *`, values);
  return created;
}

export async function updateResource(resource: ResourceName, orgId: string, id: string, input: Row) {
  const cfg = resourceConfig[resource];
  const allowed = cfg.fields.filter(field => Object.prototype.hasOwnProperty.call(input, field));
  if (!allowed.length) throw new Error("No update fields supplied");
  if (!database()) {
    const row = memory[resource].find(item => item.id === id && item.org_id === orgId);
    if (!row) return null;
    for (const field of allowed) row[field] = input[field];
    return row;
  }
  const set = allowed.map((field, index) => `${field}=$${index + 1}`).join(",");
  const values = allowed.map(field => input[field]);
  values.push(id, orgId);
  const [updated] = await sql(`update ${resource} set ${set} where id=$${allowed.length + 1} and org_id=$${allowed.length + 2} returning *`, values);
  return updated || null;
}

export async function deleteResource(resource: ResourceName, orgId: string, id: string) {
  if (!database()) {
    const index = memory[resource].findIndex(item => item.id === id && item.org_id === orgId);
    if (index < 0) return false;
    memory[resource].splice(index, 1);
    return true;
  }
  const db = database();
  if (!db) return false;
  await ensureSchema();
  const result = await db.query(`delete from ${resource} where id=$1 and org_id=$2`, [id, orgId]);
  return Boolean(result.rowCount);
}

export async function dashboard(orgId: string) {
  const [vessels, duties, workOrders, certificates, incidents, crm, events, subscriptions] = await Promise.all([
    listResource("vessels", orgId),
    listResource("duties", orgId),
    listResource("work_orders", orgId),
    listResource("certificates", orgId),
    listResource("incidents", orgId),
    listResource("crm_accounts", orgId),
    listResource("activity_events", orgId),
    listResource("subscriptions", orgId)
  ]);
  const readiness = Math.round(vessels.reduce((total, vessel) => total + Number(vessel.readiness || 0), 0) / Math.max(vessels.length, 1));
  return {
    kpis: {
      vessels: vessels.length,
      openDuties: duties.filter(duty => !["closed", "complete"].includes(String(duty.status).toLowerCase())).length,
      critical: duties.filter(duty => duty.severity === "critical").length,
      readiness,
      openWorkOrders: workOrders.filter(item => String(item.status).toLowerCase() !== "closed").length,
      expiringCertificates: certificates.filter(item => String(item.status).toLowerCase().includes("expir")).length,
      openIncidents: incidents.filter(item => String(item.status).toLowerCase() !== "closed").length,
      pipeline: crm.reduce((total, item) => total + Number(item.annual_value || 0), 0)
    },
    vessels,
    duties,
    workOrders,
    certificates,
    incidents,
    crm,
    events,
    subscriptions
  };
}

export async function findUserByEmail(email: string) {
  if (!database()) return null;
  const [user] = await sql("select * from users where lower(email)=lower($1) limit 1", [email]);
  return user || null;
}

export async function createOrganizationAndAdmin(input: { organization: string; name: string; email: string; passwordHash: string }) {
  if (!database()) throw new Error("DATABASE_URL is required for account registration");
  const orgId = uid("org");
  const userId = uid("usr");
  const db = database();
  if (!db) throw new Error("Database unavailable");
  await ensureSchema();
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("insert into organizations(id,name,plan,status) values($1,$2,'trial','trial')", [orgId, input.organization]);
    await client.query("insert into users(id,org_id,name,email,password_hash,role) values($1,$2,$3,$4,$5,'admin')", [userId, orgId, input.name, input.email.toLowerCase(), input.passwordHash]);
    await client.query("insert into subscriptions(id,org_id,plan,status) values($1,$2,'fleetops','trial')", [uid("sub"), orgId]);
    await client.query("commit");
    return { orgId, userId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertSubscription(input: { orgId: string; customerId?: string | null; subscriptionId?: string | null; plan: string; status: string; currentPeriodEnd?: string | null }) {
  const existing = await listResource("subscriptions", input.orgId);
  if (!database()) {
    if (existing[0]) Object.assign(existing[0], { stripe_customer_id: input.customerId, stripe_subscription_id: input.subscriptionId, plan: input.plan, status: input.status, current_period_end: input.currentPeriodEnd });
    else memory.subscriptions.unshift({ id: uid("sub"), org_id: input.orgId, stripe_customer_id: input.customerId, stripe_subscription_id: input.subscriptionId, plan: input.plan, status: input.status, current_period_end: input.currentPeriodEnd, created_at: now() });
    return;
  }
  if (existing[0]) {
    await sql("update subscriptions set stripe_customer_id=$1,stripe_subscription_id=$2,plan=$3,status=$4,current_period_end=$5 where id=$6 and org_id=$7", [input.customerId || null, input.subscriptionId || null, input.plan, input.status, input.currentPeriodEnd || null, existing[0].id, input.orgId]);
  } else {
    await createResource("subscriptions", input.orgId, { stripe_customer_id: input.customerId || null, stripe_subscription_id: input.subscriptionId || null, plan: input.plan, status: input.status, current_period_end: input.currentPeriodEnd || null });
  }
}
