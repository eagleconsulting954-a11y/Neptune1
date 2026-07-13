import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/server/auth";
import { recordSystemError } from "@/src/lib/server/platform-admin";

const allowedSeverities = new Set(["info", "warning", "error", "critical"]);

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 50_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });

    const body = await request.json();
    const message = String(body.message || "").trim();
    if (!message) return NextResponse.json({ error: "message is required." }, { status: 400 });

    const session = await getSession();
    await recordSystemError({
      orgId: session?.orgId || null,
      userId: session?.userId || null,
      userEmail: session?.email || null,
      source: "client",
      severity: allowedSeverities.has(body.severity) ? body.severity : "error",
      route: String(body.route || new URL(request.url).pathname).slice(0, 500),
      method: String(body.method || "CLIENT").slice(0, 16),
      message: message.slice(0, 2000),
      stack: body.stack ? String(body.stack).slice(0, 12000) : null,
      statusCode: Number.isFinite(Number(body.statusCode)) ? Number(body.statusCode) : null,
      metadata: {
        userAgent: String(request.headers.get("user-agent") || "").slice(0, 800),
        referrer: String(request.headers.get("referer") || "").slice(0, 1000),
        client: body.metadata && typeof body.metadata === "object" ? body.metadata : null
      }
    });

    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (error) {
    console.error("Error reporter failed", error);
    return NextResponse.json({ accepted: false }, { status: 202 });
  }
}
