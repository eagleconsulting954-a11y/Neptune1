import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { dashboard } from "@/src/lib/server/db";
import { canAccessModule } from "@/src/lib/plans";

function monthKey(value: string | Date) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function recentMonths(count = 6) {
  const months: { key: string; label: string }[] = [];
  const today = new Date();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
    months.push({ key: monthKey(date), label: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }) });
  }
  return months;
}

export async function GET() {
  try {
    const session = await requireSession();
    if (session.role !== "admin") return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    if (!canAccessModule(session.entitlement.plan, "analytics")) {
      return NextResponse.json({ error: "Fleet analytics is included in FleetOps, Full Vessel Access, and Enterprise packages.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }

    const data = await dashboard(session.orgId);
    const crm = data.crm || [];
    const events = data.events || [];
    const stages = crm.reduce((acc: Record<string, { count: number; value: number }>, account: any) => {
      const stage = account.stage || "Unassigned";
      acc[stage] ||= { count: 0, value: 0 };
      acc[stage].count += 1;
      acc[stage].value += Number(account.annual_value || 0);
      return acc;
    }, {});

    const pipeline = crm.reduce((sum: number, account: any) => sum + Number(account.annual_value || 0), 0);
    const won = crm.filter((account: any) => String(account.stage).toLowerCase().includes("won"));
    const weightedPipeline = crm.reduce((sum: number, account: any) => {
      const stage = String(account.stage || "").toLowerCase();
      const probability = stage.includes("won") ? 1 : stage.includes("negotiation") ? .85 : stage.includes("proposal") ? .7 : stage.includes("demo") ? .5 : stage.includes("qualified") ? .35 : .15;
      return sum + Number(account.annual_value || 0) * probability;
    }, 0);

    const trend = recentMonths().map(month => ({
      month: month.label,
      pipeline: crm
        .filter((account: any) => account.created_at && monthKey(account.created_at) === month.key)
        .reduce((sum: number, account: any) => sum + Number(account.annual_value || 0), 0),
      activity: events.filter((event: any) => event.created_at && monthKey(event.created_at) === month.key).length
    }));

    return NextResponse.json({
      storageMode: data.storageMode,
      organization: { id: session.orgId, role: session.role, email: session.email, plan: session.entitlement.planName },
      summary: {
        accounts: crm.length,
        pipeline,
        weightedPipeline: Math.round(weightedPipeline),
        averageDeal: crm.length ? Math.round(pipeline / crm.length) : 0,
        wonValue: won.reduce((sum: number, account: any) => sum + Number(account.annual_value || 0), 0),
        fleetReadiness: data.kpis.readiness,
        openDuties: data.kpis.openDuties,
        criticalItems: data.kpis.critical
      },
      stages: Object.entries(stages).map(([name, value]) => ({ name, ...value })),
      crm,
      operational: [
        { label: "Fleet readiness", value: data.kpis.readiness, suffix: "%" },
        { label: "Open duties", value: data.kpis.openDuties, suffix: "" },
        { label: "Work orders", value: data.kpis.openWorkOrders, suffix: "" },
        { label: "Expiring certificates", value: data.kpis.expiringCertificates, suffix: "" },
        { label: "Open incidents", value: data.kpis.openIncidents, suffix: "" }
      ],
      trend,
      recentActivity: events.slice(0, 8)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
    console.error(error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
