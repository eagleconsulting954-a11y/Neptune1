import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { dashboard } from "@/src/lib/server/db";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json(await dashboard(session.orgId));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
