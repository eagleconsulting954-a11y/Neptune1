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

function requireDatabase() {
  const db = database();
  if (!db) throw new Error("DATABASE_REQUIRED");
  return db;
}

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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
  if (!db) return { ok: false, mode: "unconfigured" };
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
  `);

  await db.query(`
    delete from activity_events where id in ('evt_001','evt_002');
    delete from crm_accounts where id in ('crm_001','crm_002') or email like '%.example';
    delete from incidents where id='inc_001';
    delete from certificates where id='cert_001';
    delete from work_orders where id='wo_001';
    delete from duties where id in ('dty_001','dty_002','dty_003');
    delete from vessels where id in ('vsl_001','vsl_002','vsl_003');
    delete from subscriptions where id='sub_demo';
  `);

  return { ok: true, mode: "postgres" };
}

export async function sql<T extends Row = Row>(text: string, params: any[] = []): Promise<T[]> {
  const db = requireDatabase();
  await ensureSchema();
  const result = await db.query(text, params);
  return result.rows as T[];
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function listResource(resource: ResourceName, orgId: string) {
  if (!database()) return [];
  return sql(`select * from ${resource} where org_id=$1 order by created_at desc`, [orgId]);
}

export async function createResource(resource: ResourceName, orgId: string, input: Row) {
  requireDatabase();
  const cfg = resourceConfig[resource];
  const row: Row = { id: uid(cfg.prefix), org_id: orgId };
  for (const field of cfg.fields) row[field] = input[field] ?? null;
  const fields = ["id", "org_id", ...cfg.fields];
  const values = fields.map(field => row[field]);
  const placeholders = fields.map((_, index) => `$${index + 1}`).join(",");
  const [created] = await sql(`insert into ${resource}(${fields.join(",")}) values(${placeholders}) returning *`, values);
  return created;
}

export async function updateResource(resource: ResourceName, orgId: string, id: string, input: Row) {
  requireDatabase();
  const cfg = resourceConfig[resource];
  const allowed = cfg.fields.filter(field => Object.prototype.hasOwnProperty.call(input, field));
  if (!allowed.length) throw new Error("No update fields supplied");
  const set = allowed.map((field, index) => `${field}=$${index + 1}`).join(",");
  const values = allowed.map(field => input[field]);
  values.push(id, orgId);
  const [updated] = await sql(`update ${resource} set ${set} where id=$${allowed.length + 1} and org_id=$${allowed.length + 2} returning *`, values);
  return updated || null;
}

export async function deleteResource(resource: ResourceName, orgId: string, id: string) {
  const db = requireDatabase();
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
  const readiness = vessels.length ? Math.round(vessels.reduce((total, vessel) => total + Number(vessel.readiness || 0), 0) / vessels.length) : 0;
  return {
    storageMode: hasDatabase() ? "postgres" : "unconfigured",
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
  const db = requireDatabase();
  const orgId = uid("org");
  const userId = uid("usr");
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
  requireDatabase();
  const existing = await listResource("subscriptions", input.orgId);
  if (existing[0]) {
    await sql("update subscriptions set stripe_customer_id=$1,stripe_subscription_id=$2,plan=$3,status=$4,current_period_end=$5 where id=$6 and org_id=$7", [input.customerId || null, input.subscriptionId || null, input.plan, input.status, input.currentPeriodEnd || null, existing[0].id, input.orgId]);
  } else {
    await createResource("subscriptions", input.orgId, { stripe_customer_id: input.customerId || null, stripe_subscription_id: input.subscriptionId || null, plan: input.plan, status: input.status, current_period_end: input.currentPeriodEnd || null });
  }
}
