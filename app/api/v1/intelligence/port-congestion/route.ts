import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { listResource } from "@/src/lib/server/db";
import { fetchPortCongestion, saveCongestionSnapshot } from "@/src/lib/server/maritime";
import { canAccessModule } from "@/src/lib/plans";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessModule(session.entitlement.plan, "maritime_intel")) {
      return NextResponse.json({ error: "Port intelligence is included in Captain, Full Vessel Access, and Enterprise packages.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }
    const portId = new URL(request.url).searchParams.get("portId");
    if (!portId) return NextResponse.json({ error: "portId is required." }, { status: 400 });
    const ports = await listResource("ports", session.orgId);
    const port = ports.find(item => item.id === portId);
    if (!port) return NextResponse.json({ error: "Port not found." }, { status: 404 });
    const congestion = await fetchPortCongestion(port);
    if (congestion.configured) await saveCongestionSnapshot(session.orgId, port.id, congestion);
    return NextResponse.json({ port, congestion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown congestion provider error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "DATABASE_URL is required for port intelligence." }, { status: 503 });
    console.error(error);
    return NextResponse.json({ error: "Unable to retrieve port congestion data.", detail: message }, { status: 502 });
  }
}
