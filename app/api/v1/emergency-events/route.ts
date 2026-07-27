import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { canAccessModule } from "@/src/lib/plans";
import { createEmergencyEvent, listEmergencyEvents, updateEmergencyEvent } from "@/src/lib/server/emergency-db";

function assertAccess(plan: string) {
  if (!canAccessModule(plan, "seafarer_safety")) throw new Error("PLAN_UPGRADE_REQUIRED");
}

function responseFor(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
  if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  if (message === "PLAN_UPGRADE_REQUIRED") return NextResponse.json({ error: "Emergency GPS is included with Full Vessel Access and Enterprise.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
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
    return NextResponse.json({ items: await listEmergencyEvents(session.orgId, limit) });
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    assertAccess(session.entitlement.plan);
    const body = await request.json();
    return NextResponse.json({ item: await createEmergencyEvent(session.orgId, body) }, { status: 201 });
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
    const item = await updateEmergencyEvent(session.orgId, body);
    return item ? NextResponse.json({ item }) : NextResponse.json({ error: "Emergency event not found" }, { status: 404 });
  } catch (error) {
    return responseFor(error);
  }
}
