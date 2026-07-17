import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { getWeatherAndOcean } from "@/src/lib/server/maritime";
import { canAccessModule } from "@/src/lib/plans";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessModule(session.entitlement.plan, "maritime_intel")) {
      return NextResponse.json({ error: "Maritime Intelligence is included in Captain, Full Vessel Access, and Enterprise packages.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }
    const url = new URL(request.url);
    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lon"));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return NextResponse.json({ error: "Valid lat and lon coordinates are required." }, { status: 400 });
    return NextResponse.json(await getWeatherAndOcean(latitude, longitude));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown weather provider error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Unable to retrieve live weather and marine forecast data.", detail: message }, { status: 502 });
  }
}
