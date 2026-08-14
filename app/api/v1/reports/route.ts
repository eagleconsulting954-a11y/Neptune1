import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { buildReport, normalizeReportType, reportCsv, reportHtml } from "@/src/lib/server/reports";
import { recordAuditEvent } from "@/src/lib/server/security";

function safeFile(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "neptune-report";
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active Neptune access is required." }, { status: 402 });
  if (message === "REPORT_MANAGER_REQUIRED") return NextResponse.json({ error: "This fleet-wide report is restricted to organization managers." }, { status: 403 });
  if (message === "REPORT_TYPE_INVALID") return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: "Unable to generate this Neptune report." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const type = normalizeReportType(url.searchParams.get("type"));
    const format = String(url.searchParams.get("format") || "json").toLowerCase();
    const eventId = url.searchParams.get("eventId");
    const report = await buildReport(session, type, eventId);
    await recordAuditEvent({ session, action: "report.generated", entityType: "report", entityId: report.reportId, route: "/api/v1/reports", method: "GET", request, metadata: { type, format, evidenceHash: report.evidenceHash } });

    if (format === "csv") {
      return new NextResponse(reportCsv(report), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${safeFile(report.title)}-${report.reportId.slice(-8)}.csv"`,
          "cache-control": "no-store"
        }
      });
    }
    if (format === "html") {
      return new NextResponse(reportHtml(report), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }
    return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
