import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { canAccessModule } from "@/src/lib/plans";
import { listEmergencyPositions } from "@/src/lib/server/emergency-db";
import { allowedVesselIds } from "@/src/lib/server/org-access";
import { sql, type Row } from "@/src/lib/server/db";

function responseFor(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required." }, { status: 402 });
  if (message === "VESSEL_PERMISSION_REQUIRED") return NextResponse.json({ error: "Your organization role does not permit access to this vessel emergency trail." }, { status: 403 });
  if (message === "EVENT_NOT_FOUND") return NextResponse.json({ error: "Emergency event not found." }, { status: 404 });
  if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "Persistent database is not configured." }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Unable to load the emergency GPS trail." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessModule(session.entitlement.plan, "seafarer_safety")) return NextResponse.json({ error: "Emergency GPS is included with Full Vessel Access and Enterprise." }, { status: 403 });
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    const [event] = await sql<Row>("select id,vessel_id from emergency_events where id=$1 and org_id=$2 limit 1", [eventId, session.orgId]);
    if (!event) throw new Error("EVENT_NOT_FOUND");
    const allowed = await allowedVesselIds(session, false);
    if (allowed !== null && (!event.vessel_id || !allowed.has(String(event.vessel_id)))) throw new Error("VESSEL_PERMISSION_REQUIRED");
    const limit = Number(url.searchParams.get("limit") || 2000);
    return NextResponse.json({ items: await listEmergencyPositions(session.orgId, eventId, limit) });
  } catch (error) {
    return responseFor(error);
  }
}
