import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/server/auth";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import { FEATURE_FLAGS, featureFlagSnapshot } from "@/src/lib/server/feature-flags";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (!isDesignatedAdminEmail(session.email)) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const orgId = new URL(request.url).searchParams.get("orgId") || undefined;
  return NextResponse.json({
    defaults: FEATURE_FLAGS,
    effective: featureFlagSnapshot(orgId),
    organization: orgId || null,
    source: process.env.NEPTUNE_FEATURE_FLAGS ? "environment" : "defaults",
    note: "Feature flags are server-authoritative. Update NEPTUNE_FEATURE_FLAGS through the deployment environment and redeploy after review."
  });
}
