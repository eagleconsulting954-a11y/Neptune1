import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { canAccessModule } from "@/src/lib/plans";
import { sql, type Row } from "@/src/lib/server/db";

async function ensureEvRiskSchema() {
  await sql(`
    create table if not exists ev_risk_workspaces (
      org_id text primary key references organizations(id) on delete cascade,
      workspace jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);
}

function accessError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
  if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "Production database is not configured." }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Unable to load the EV risk workspace." }, { status: 500 });
}

async function requireEvRiskAccess() {
  const session = await requireSession();
  if (!canAccessModule(session.entitlement.plan, "ev_projects")) {
    throw new Error("PLAN_UPGRADE_REQUIRED");
  }
  return session;
}

export async function GET() {
  try {
    const session = await requireEvRiskAccess();
    await ensureEvRiskSchema();
    const [saved] = await sql<Row>("select workspace,updated_at from ev_risk_workspaces where org_id=$1", [session.orgId]);
    return NextResponse.json({ workspace: saved?.workspace || null, updatedAt: saved?.updated_at || null });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_UPGRADE_REQUIRED") {
      return NextResponse.json({ error: "Future Maritime EV Risk is included in Full Vessel Access and Enterprise.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }
    return accessError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireEvRiskAccess();
    const body = await request.json().catch(() => ({}));
    const workspace = body.workspace;
    if (!workspace || typeof workspace !== "object" || Array.isArray(workspace)) {
      return NextResponse.json({ error: "A valid EV risk workspace is required." }, { status: 400 });
    }
    const serialized = JSON.stringify(workspace);
    if (serialized.length > 150_000) {
      return NextResponse.json({ error: "The EV risk workspace is too large to save." }, { status: 413 });
    }

    await ensureEvRiskSchema();
    const [saved] = await sql<Row>(`
      insert into ev_risk_workspaces(org_id,workspace,updated_at)
      values($1,$2::jsonb,now())
      on conflict(org_id) do update set
        workspace=excluded.workspace,
        updated_at=now()
      returning updated_at
    `, [session.orgId, serialized]);

    return NextResponse.json({ ok: true, updatedAt: saved.updated_at });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_UPGRADE_REQUIRED") {
      return NextResponse.json({ error: "Future Maritime EV Risk is included in Full Vessel Access and Enterprise.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }
    return accessError(error);
  }
}
