import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { sql, type Row } from "@/src/lib/server/db";
import { canAccessModule } from "@/src/lib/plans";

const DELIVERABLES = [
  { workstream: "Technical", deliverable: "Shipyard Spec for e-PCTC", nextAction: "Assign naval architecture and class review ownership." },
  { workstream: "Operations", deliverable: "MASS Shore Control SOP", nextAction: "Assign shore control, emergency response, and cyber-control owners." },
  { workstream: "Regulatory", deliverable: "IMO Proposal Deck", nextAction: "Assign regulatory drafting, evidence, and stakeholder consultation owners." }
];

const STATUS_VALUES = new Set(["Not started", "Planning", "In progress", "Blocked", "Under review", "Approved", "Complete"]);

async function ensureFutureEvSchema() {
  await sql(`
    create table if not exists future_ev_projects (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      workstream text not null,
      deliverable text not null,
      owner text,
      accountable text,
      status text not null default 'Not started',
      target_date text,
      next_action text,
      evidence text,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(org_id, deliverable)
    );
    create index if not exists idx_future_ev_projects_org_status on future_ev_projects(org_id,status);
    create index if not exists idx_future_ev_projects_org_target on future_ev_projects(org_id,target_date);
  `);
}

function accessError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
  if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  console.error(error);
  return NextResponse.json({ error: "Unable to update the Future EV program." }, { status: 500 });
}

async function futureEvSession() {
  const session = await requireSession();
  if (!canAccessModule(session.entitlement.plan, "future_ev")) throw new Error("PLAN_UPGRADE_REQUIRED");
  return session;
}

export async function GET() {
  try {
    const session = await futureEvSession();
    await ensureFutureEvSchema();
    const projects = await sql<Row>("select * from future_ev_projects where org_id=$1 order by created_at asc", [session.orgId]);
    return NextResponse.json({ projects });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_UPGRADE_REQUIRED") {
      return NextResponse.json({ error: "Future EV Vessels is included with Full Vessel Access and Enterprise.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }
    return accessError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await futureEvSession();
    await ensureFutureEvSchema();
    const body = await request.json().catch(() => ({}));

    if (body.action === "initialize") {
      for (const item of DELIVERABLES) {
        await sql(`
          insert into future_ev_projects(id,org_id,workstream,deliverable,status,next_action)
          values($1,$2,$3,$4,'Not started',$5)
          on conflict(org_id,deliverable) do nothing
        `, [`fev_${randomUUID()}`, session.orgId, item.workstream, item.deliverable, item.nextAction]);
      }
      const projects = await sql<Row>("select * from future_ev_projects where org_id=$1 order by created_at asc", [session.orgId]);
      return NextResponse.json({ ok: true, projects }, { status: 201 });
    }

    const workstream = String(body.workstream || "").trim();
    const deliverable = String(body.deliverable || "").trim();
    if (!workstream || !deliverable) return NextResponse.json({ error: "Workstream and deliverable are required." }, { status: 400 });
    const status = STATUS_VALUES.has(String(body.status)) ? String(body.status) : "Not started";
    const [project] = await sql<Row>(`
      insert into future_ev_projects(id,org_id,workstream,deliverable,owner,accountable,status,target_date,next_action,evidence,notes)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      returning *
    `, [
      `fev_${randomUUID()}`,
      session.orgId,
      workstream,
      deliverable,
      String(body.owner || "").trim() || null,
      String(body.accountable || "").trim() || null,
      status,
      String(body.target_date || "").trim() || null,
      String(body.next_action || "").trim() || null,
      String(body.evidence || "").trim() || null,
      String(body.notes || "").trim() || null
    ]);
    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_UPGRADE_REQUIRED") {
      return NextResponse.json({ error: "Future EV Vessels is included with Full Vessel Access and Enterprise.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }
    return accessError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await futureEvSession();
    await ensureFutureEvSchema();
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Project id is required." }, { status: 400 });

    const allowed = ["workstream", "deliverable", "owner", "accountable", "status", "target_date", "next_action", "evidence", "notes"];
    const fields = allowed.filter(field => Object.prototype.hasOwnProperty.call(body, field));
    if (!fields.length) return NextResponse.json({ error: "No project fields were supplied." }, { status: 400 });
    if (fields.includes("status") && !STATUS_VALUES.has(String(body.status))) {
      return NextResponse.json({ error: "Select a valid project status." }, { status: 400 });
    }

    const set = fields.map((field, index) => `${field}=$${index + 1}`).join(",");
    const values = fields.map(field => String(body[field] ?? "").trim() || null);
    values.push(id, session.orgId);
    const [project] = await sql<Row>(`
      update future_ev_projects
      set ${set},updated_at=now()
      where id=$${fields.length + 1} and org_id=$${fields.length + 2}
      returning *
    `, values);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_UPGRADE_REQUIRED") {
      return NextResponse.json({ error: "Future EV Vessels is included with Full Vessel Access and Enterprise.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }
    return accessError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await futureEvSession();
    await ensureFutureEvSchema();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Project id is required." }, { status: 400 });
    const deleted = await sql<Row>("delete from future_ev_projects where id=$1 and org_id=$2 returning id", [id, session.orgId]);
    return NextResponse.json({ ok: Boolean(deleted[0]) });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_UPGRADE_REQUIRED") {
      return NextResponse.json({ error: "Future EV Vessels is included with Full Vessel Access and Enterprise.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }
    return accessError(error);
  }
}
