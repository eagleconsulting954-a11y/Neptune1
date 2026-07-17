import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { createResource, listResource } from "@/src/lib/server/db";
import { nearestMrcc } from "@/src/lib/server/maritime";
import { canAccessModule } from "@/src/lib/plans";

function packageError() {
  return NextResponse.json({ error: "MRCC intelligence is included in Captain, Full Vessel Access, and Enterprise packages.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessModule(session.entitlement.plan, "maritime_intel")) return packageError();
    const url = new URL(request.url);
    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lon"));
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return NextResponse.json({ contacts: await nearestMrcc(session.orgId, latitude, longitude) });
    }
    return NextResponse.json({ contacts: await listResource("mrcc_contacts", session.orgId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Unable to load MRCC contacts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessModule(session.entitlement.plan, "maritime_intel")) return packageError();
    if (session.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const body = await request.json();
    const contacts = Array.isArray(body.contacts) ? body.contacts : [body];
    const created = [];
    for (const contact of contacts) {
      if (!contact.name || !contact.country || !contact.source_url || !contact.verified_at) {
        return NextResponse.json({ error: "Each MRCC contact requires name, country, source_url, and verified_at." }, { status: 400 });
      }
      created.push(await createResource("mrcc_contacts", session.orgId, contact));
    }
    return NextResponse.json({ contacts: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    console.error(error);
    if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "DATABASE_URL is required to store verified MRCC contacts." }, { status: 503 });
    return NextResponse.json({ error: "Unable to save MRCC contacts." }, { status: 500 });
  }
}
