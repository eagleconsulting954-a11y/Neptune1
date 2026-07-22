import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { sql, type Row } from "@/src/lib/server/db";
import { canAccessModule } from "@/src/lib/plans";

const STATUSES = new Set(["Not started", "Discovery", "In design", "Class review", "Pilot", "Blocked", "Approved", "Complete"]);
const WORKSTREAMS = new Set(["Shipyard Spec", "MASS Shore Control SOP", "IMO Proposal Deck", "Commercial & Insurance", "Flag State", "Emergency Port Network", "Digital Twin", "Other"]);

async function ensureSchema() {
  await sql(`
    create table if not exists ev_future_projects (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      title text not null,
      workstream text not null,
      vessel_concept text,
      owner text not null,
      accountable_executive text,
      status text not null default 'Not started',
      target_year integer not null default 2030,
      progress integer not null default 0,
      next_gate text,
      due_at date,
      evidence_url text,
      blocker text,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_ev_future_projects_org on ev_future_projects(org_id, target_year, updated_at desc);
  `);
}

function text(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function normalizeYear(value: unknown) {
  const year = Number(value || 2030);
  return Number.isFinite(year) ? Math.max(2026, Math.min(2035, Math.round(year))) : 2030;
}

function normalizeProgress(value: unknown) {
  const progress = Number(value || 0);
  return Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0;
}

function normalizeStatus(value: unknown) {
  const status = text(value, 40) || "Not started";
  return STATUSES.has(status) ? status : "Not started";
}

function normalizeWorkstream(value: unknown) {
  const workstream = text(value, 80) || "Other";
  return WORKSTREAMS.has(workstream) ? workstream : "Other";
}

function payload(body: Record<string, unknown>) {
  return {
    title: text(body.title, 180),
    workstream: normalizeWorkstream(body.workstream),
    vesselConcept: text(body.vesselConcept ?? body.vessel_concept, 160),
    owner: text(body.owner, 120),
    accountableExecutive: text(body.accountableExecutive ?? body.accountable_executive, 120),
    status: normalizeStatus(body.status),
    targetYear: normalizeYear(body.targetYear ?? body.target_year),
    progress: normalizeProgress(body.progress),
    nextGate: text(body.nextGate ?? body.next_gate, 300),
    dueAt: text(body.dueAt ?? body.due_at, 10) || null,
    evidenceUrl: text(body.evidenceUrl ?? body.evidence_url, 500),
    blocker: text(body.blocker, 500),
    notes: text(body.notes, 3000)
  };
}

function responseFor(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
  if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  if (message === "PLAN_UPGRADE_REQUIRED") return NextResponse.json({ error: "EV Future Projects is included in Full Vessel Access and Enterprise.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
  console.error(error);
  return NextResponse.json({ error: "Unable to update the EV future-project program." }, { status: 500 });
}

async function sessionWithAccess() {
  const session = await requireSession();
  if (!canAccessModule(session.entitlement.plan, "ev_projects")) throw new Error("PLAN_UPGRADE_REQUIRED");
  await ensureSchema();
  return session;
}

export async function GET() {
  try {
    const session = await sessionWithAccess();
    const projects = await sql<Row>(`
      select * from ev_future_projects
      where org_id=$1
      order by target_year asc,
        case status when 'Blocked' then 0 when 'Pilot' then 1 when 'Class review' then 2 else 3 end,
        updated_at desc
    `, [session.orgId]);
    return NextResponse.json({ projects });
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await sessionWithAccess();
    const input = payload(await request.json().catch(() => ({})));
    if (!input.title || !input.owner) {
      return NextResponse.json({ error: "Project title and accountable owner are required." }, { status: 400 });
    }
    const [project] = await sql<Row>(`
      insert into ev_future_projects(
        id,org_id,title,workstream,vessel_concept,owner,accountable_executive,status,
        target_year,progress,next_gate,due_at,evidence_url,blocker,notes
      ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      returning *
    `, [
      `evp_${randomUUID()}`, session.orgId, input.title, input.workstream, input.vesselConcept,
      input.owner, input.accountableExecutive, input.status, input.targetYear, input.progress,
      input.nextGate, input.dueAt, input.evidenceUrl, input.blocker, input.notes
    ]);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return responseFor(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await sessionWithAccess();
    const body = await request.json().catch(() => ({}));
    const id = text(body.id, 120);
    const input = payload(body);
    if (!id || !input.title || !input.owner) {
      return NextResponse.json({ error: "Project ID, title, and accountable owner are required." }, { status: 400 });
    }
    const [project] = await sql<Row>(`
      update ev_future_projects set
        title=$1,workstream=$2,vessel_concept=$3,owner=$4,accountable_executive=$5,
        status=$6,target_year=$7,progress=$8,next_gate=$9,due_at=$10,evidence_url=$11,
        blocker=$12,notes=$13,updated_at=now()
      where id=$14 and org_id=$15
      returning *
    `, [
      input.title, input.workstream, input.vesselConcept, input.owner, input.accountableExecutive,
      input.status, input.targetYear, input.progress, input.nextGate, input.dueAt,
      input.evidenceUrl, input.blocker, input.notes, id, session.orgId
    ]);
    return project
      ? NextResponse.json({ project })
      : NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch (error) {
    return responseFor(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await sessionWithAccess();
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
    const [deleted] = await sql<Row>("delete from ev_future_projects where id=$1 and org_id=$2 returning id", [id, session.orgId]);
    return deleted
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch (error) {
    return responseFor(error);
  }
}
