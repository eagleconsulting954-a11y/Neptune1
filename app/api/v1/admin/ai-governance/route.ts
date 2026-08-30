import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { ensureSchema, sql } from "@/src/lib/server/db";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import { ensureAiGovernanceSchema } from "@/src/lib/server/ai-governance-schema";
import {
  createAiSystem,
  createFinding,
  deleteAiSystem,
  listGovernance,
  recordDecision,
  recordEvaluation,
  updateAiSystem,
  updateFinding,
  upsertControl
} from "@/src/lib/server/ai-governance";

function responseForError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required." }, { status: 402 });
  if (message === "ADMIN_EMAIL_REQUIRED") return NextResponse.json({ error: "AI Governance is restricted to the two designated Neptune administrator emails." }, { status: 403 });
  if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "Production PostgreSQL is required for AI Governance." }, { status: 503 });
  if (message === "AI_GOV_SYSTEM_NOT_FOUND") return NextResponse.json({ error: "AI system not found." }, { status: 404 });
  if (message === "AI_GOV_FINDING_NOT_FOUND") return NextResponse.json({ error: "Governance finding not found." }, { status: 404 });
  if (message.includes("_REQUIRED")) return NextResponse.json({ error: "Complete the required governance fields." }, { status: 400 });
  if (message.includes("_INVALID")) return NextResponse.json({ error: "One or more governance values are invalid." }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: "Unable to complete the AI governance request." }, { status: 500 });
}

async function adminSession() {
  const session = await requireSession();
  if (!isDesignatedAdminEmail(session.email)) throw new Error("ADMIN_EMAIL_REQUIRED");
  await ensureSchema();
  await ensureAiGovernanceSchema();
  return session;
}

export async function GET() {
  try {
    const session = await adminSession();
    return NextResponse.json(await listGovernance(session.orgId));
  } catch (error) {
    return responseForError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await adminSession();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    const input = body.input && typeof body.input === "object" ? body.input : body;
    if (action === "system.create") return NextResponse.json({ item: await createAiSystem(session, input, request) }, { status: 201 });
    if (action === "control.upsert") return NextResponse.json({ item: await upsertControl(session, input, request) });
    if (action === "finding.create") return NextResponse.json({ item: await createFinding(session, input, request) }, { status: 201 });
    if (action === "evaluation.record") return NextResponse.json({ item: await recordEvaluation(session, input, request) }, { status: 201 });
    if (action === "decision.record") return NextResponse.json({ item: await recordDecision(session, input, request) }, { status: 201 });
    return NextResponse.json({ error: "Unknown governance action." }, { status: 400 });
  } catch (error) {
    return responseForError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await adminSession();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    const id = String(body.id || body.input?.id || "").trim();
    const input = body.input && typeof body.input === "object" ? body.input : body;
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    if (action === "system.update") return NextResponse.json({ item: await updateAiSystem(session, id, input, request) });
    if (action === "finding.update") return NextResponse.json({ item: await updateFinding(session, id, input, request) });
    return NextResponse.json({ error: "Unknown governance action." }, { status: 400 });
  } catch (error) {
    return responseForError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await adminSession();
    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const [evidence] = await sql(`
      select
        (select count(*)::int from ai_decision_records where org_id=$1 and system_id=$2) as decisions,
        (select count(*)::int from ai_assurance_evaluations where org_id=$1 and system_id=$2) as evaluations
    `, [session.orgId, id]);
    if (Number(evidence?.decisions || 0) || Number(evidence?.evaluations || 0)) {
      return NextResponse.json({ error: "This AI system has append-only governance evidence. Retire the system instead of deleting it." }, { status: 409 });
    }

    await deleteAiSystem(session, id, request);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return responseForError(error);
  }
}
