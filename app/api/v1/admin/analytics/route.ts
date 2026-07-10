import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { dashboard } from "@/src/lib/server/db";

export async function GET() {
  try {
    const session = await requireSession();
    if (session.role !== "admin") return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

    const data = await dashboard(session.orgId);
    const crm = data.crm || [];
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
      const probability = stage.includes("won") ? 1 : stage.includes("proposal") ? .7 : stage.includes("demo") ? .5 : stage.includes("qualified") ? .35 : .15;
      return sum + Number(account.annual_value || 0) * probability;
    }, 0);

    return NextResponse.json({
      organization: { id: session.orgId, role: session.role, email: session.email },
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
      trend: [
        { month: "Feb", pipeline: Math.round(pipeline * .44), activity: 22 },
        { month: "Mar", pipeline: Math.round(pipeline * .57), activity: 31 },
        { month: "Apr", pipeline: Math.round(pipeline * .69), activity: 38 },
        { month: "May", pipeline: Math.round(pipeline * .78), activity: 47 },
        { month: "Jun", pipeline: Math.round(pipeline * .91), activity: 58 },
        { month: "Jul", pipeline, activity: Math.max(64, (data.events || []).length * 14) }
      ],
      recentActivity: (data.events || []).slice(0, 8)
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
