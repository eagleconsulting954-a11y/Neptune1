import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { canAccessModule } from "@/src/lib/plans";
import { createEmergencyEvent, listEmergencyEvents, updateEmergencyEvent } from "@/src/lib/server/emergency-db";
import { allowedVesselIds } from "@/src/lib/server/org-access";
import { recordAuditEvent } from "@/src/lib/server/security";
import { sql, type Row } from "@/src/lib/server/db";

function assertAccess(plan: string) {
  if (!canAccessModule(plan, "seafarer_safety")) throw new Error("PLAN_UPGRADE_REQUIRED");
}

async function assertVesselAccess(session: any, vesselId: unknown, edit: boolean) {
  const allowed = await allowedVesselIds(session, edit);
  if (allowed !== null && (!vesselId || !allowed.has(String(vesselId)))) throw new Error("VESSEL_PERMISSION_REQUIRED");
}

function responseFor(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
  if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  if (message === "PLAN_UPGRADE_REQUIRED") return NextResponse.json({ error: "Emergency GPS is included with Full Vessel Access and Enterprise.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
  if (message === "VESSEL_PERMISSION_REQUIRED") return NextResponse.json({ error: "Your organization role does not permit access to this vessel emergency record.", code: "VESSEL_PERMISSION_REQUIRED" }, { status: 403 });
  if (message === "VESSEL_NOT_FOUND") return NextResponse.json({ error: "The selected vessel does not belong to this organization." }, { status: 400 });
  if (["INVALID_RECORDED_AT", "EVENT_ID_CONFLICT", "NO_UPDATE_FIELDS"].includes(message)) return NextResponse.json({ error: message.replaceAll("_", " ").toLowerCase() }, { status: 400 });
  if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "Persistent database is not configured." }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Unable to complete emergency GPS request." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    assertAccess(session.entitlement.plan);
    const limit = Number(new URL(request.url).searchParams.get("limit") || 20);
    const items = await listEmergencyEvents(session.orgId, limit);
    const allowed = await allowedVesselIds(session, false);
    return NextResponse.json({ items: allowed === null ? items : items.filter((item: Row) => item.vessel_id && allowed.has(String(item.vessel_id))) });
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    assertAccess(session.entitlement.plan);
    const body = await request.json();
    await assertVesselAccess(session, body.vessel_id, true);
    const item = await createEmergencyEvent(session.orgId, body);
    await recordAuditEvent({ session, action: "emergency.event_created", entityType: "emergency_event", entityId: item.id, route: "/api/v1/emergency-events", method: "POST", request, metadata: { vesselId: item.vessel_id, offline: String(body.id || "").startsWith("emg_offline_") } });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return responseFor(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    assertAccess(session.entitlement.plan);
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const [existing] = await sql<Row>("select id,vessel_id from emergency_events where id=$1 and org_id=$2 limit 1", [body.id, session.orgId]);
    if (!existing) return NextResponse.json({ error: "Emergency event not found" }, { status: 404 });
    await assertVesselAccess(session, existing.vessel_id, true);
    if (Object.prototype.hasOwnProperty.call(body, "vessel_id")) await assertVesselAccess(session, body.vessel_id, true);
    const item = await updateEmergencyEvent(session.orgId, body);
    if (!item) return NextResponse.json({ error: "Emergency event not found" }, { status: 404 });
    await recordAuditEvent({ session, action: "emergency.event_updated", entityType: "emergency_event", entityId: item.id, route: "/api/v1/emergency-events", method: "PATCH", request, metadata: { vesselId: item.vessel_id, status: item.status } });
    return NextResponse.json({ item });
  } catch (error) {
    return responseFor(error);
  }
}
