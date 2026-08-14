import { NextResponse } from "next/server";
import { hasDatabase, sql, type Row } from "@/src/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  let database = false;
  let databaseLatencyMs: number | null = null;

  if (hasDatabase()) {
    const started = Date.now();
    try {
      const [result] = await sql<Row>("select 1 as ok");
      database = Number(result?.ok || 0) === 1;
      databaseLatencyMs = Date.now() - started;
    } catch {
      database = false;
      databaseLatencyMs = Date.now() - started;
    }
  }

  const status = database ? "operational" : "degraded";
  return NextResponse.json({
    status,
    checkedAt,
    services: {
      application: true,
      database
    },
    metrics: {
      databaseLatencyMs
    },
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local"
  }, {
    status: status === "operational" ? 200 : 503,
    headers: { "cache-control": "no-store, max-age=0" }
  });
}
