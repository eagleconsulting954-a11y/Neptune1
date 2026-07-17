import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { dashboard } from "@/src/lib/server/db";
import { buildDecisionInsights } from "@/src/lib/server/decision-insights";
import { filterDashboardForPlan } from "@/src/lib/server/plan-dashboard";

export async function GET() {
  try {
    const session = await requireSession();
    const raw = await dashboard(session.orgId);
    const data = filterDashboardForPlan(raw, session.entitlement.plan);
    const insights = await buildDecisionInsights(session.orgId, data as any);
    return NextResponse.json({ ...data, insights, entitlement: session.entitlement });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
    if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "Production database is not configured." }, { status: 503 });
    console.error(error);
    return NextResponse.json({ error: "Unable to load the decision dashboard." }, { status: 500 });
  }
}
