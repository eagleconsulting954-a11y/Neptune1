import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { canAccessModule } from "@/src/lib/plans";
import { listEmergencyPositions } from "@/src/lib/server/emergency-db";

function responseFor(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required." }, { status: 402 });
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
    const limit = Number(url.searchParams.get("limit") || 2000);
    return NextResponse.json({ items: await listEmergencyPositions(session.orgId, eventId, limit) });
  } catch (error) {
    return responseFor(error);
  }
}
