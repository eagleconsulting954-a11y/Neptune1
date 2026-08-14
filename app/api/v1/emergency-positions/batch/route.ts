import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { canAccessModule } from "@/src/lib/plans";
import { insertEmergencyPositions } from "@/src/lib/server/emergency-db";
import { allowedVesselIds } from "@/src/lib/server/org-access";
import { recordAuditEvent } from "@/src/lib/server/security";
import { sql, type Row } from "@/src/lib/server/db";

function responseFor(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required." }, { status: 402 });
  if (message === "EVENT_NOT_FOUND") return NextResponse.json({ error: "Emergency event not found." }, { status: 404 });
  if (message === "VESSEL_PERMISSION_REQUIRED") return NextResponse.json({ error: "Your organization role does not permit GPS updates for this vessel." }, { status: 403 });
  if (["INVALID_COORDINATES", "INVALID_SEQUENCE", "INVALID_RECORDED_AT"].includes(message)) return NextResponse.json({ error: message.replaceAll("_", " ").toLowerCase() }, { status: 400 });
  if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "Persistent database is not configured." }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Unable to store emergency GPS positions." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessModule(session.entitlement.plan, "seafarer_safety")) return NextResponse.json({ error: "Emergency GPS is included with Full Vessel Access and Enterprise." }, { status: 403 });
    const body = await request.json();
    if (!body.event_id) return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    if (!Array.isArray(body.positions) || body.positions.length === 0) return NextResponse.json({ error: "positions are required" }, { status: 400 });
    if (body.positions.length > 250) return NextResponse.json({ error: "A maximum of 250 positions can be submitted per batch." }, { status: 400 });
    const [event] = await sql<Row>("select id,vessel_id from emergency_events where id=$1 and org_id=$2 limit 1", [String(body.event_id), session.orgId]);
    if (!event) throw new Error("EVENT_NOT_FOUND");
    const allowed = await allowedVesselIds(session, true);
    if (allowed !== null && (!event.vessel_id || !allowed.has(String(event.vessel_id)))) throw new Error("VESSEL_PERMISSION_REQUIRED");
    const result = await insertEmergencyPositions(session.orgId, String(body.event_id), body.positions);
    await recordAuditEvent({ session, action: "emergency.positions_synced", entityType: "emergency_event", entityId: String(body.event_id), route: "/api/v1/emergency-positions/batch", method: "POST", request, metadata: { vesselId: event.vessel_id, submitted: body.positions.length, inserted: result.inserted } });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return responseFor(error);
  }
}
