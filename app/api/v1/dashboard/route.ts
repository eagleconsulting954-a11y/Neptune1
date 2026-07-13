import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { dashboard } from "@/src/lib/server/db";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json(await dashboard(session.orgId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
    if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "Production database is not configured." }, { status: 503 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
