import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createOrganizationAndAdmin, findUserByEmail } from "@/src/lib/server/db";
import { setAccessCookie, setSession } from "@/src/lib/server/auth";
import { startTrial } from "@/src/lib/server/trial";
import { normalizePlan } from "@/src/lib/plans";
import { recordSystemError } from "@/src/lib/server/platform-admin";

export async function POST(request: Request) {
  let email = "";
  let organization = "";
  try {
    const body = await request.json();
    organization = String(body.organization || "").trim();
    const name = String(body.name || "").trim();
    email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const selectedPlan = normalizePlan(body.plan || "captain");

    if (!organization || !name || !email || password.length < 8) {
      return NextResponse.json({ error: "Complete all fields and use at least 8 password characters." }, { status: 400 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "Account registration is temporarily unavailable because the production database is not connected." }, { status: 503 });
    }
    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await createOrganizationAndAdmin({ organization, name, email, passwordHash });
    const entitlement = await startTrial(result.orgId, selectedPlan);

    await setSession({ userId: result.userId, orgId: result.orgId, role: "admin", email });
    await setAccessCookie(entitlement);

    return NextResponse.json({
      ok: true,
      redirect: "/dashboard",
      trial: {
        days: 14,
        plan: entitlement.plan,
        planName: entitlement.planName,
        startsAt: new Date().toISOString(),
        endsAt: entitlement.expiresAt
      }
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    await recordSystemError({
      source: "api",
      severity: "critical",
      route: "/api/auth/signup",
      method: "POST",
      message: error instanceof Error ? error.message : "Unknown signup failure",
      stack: error instanceof Error ? error.stack : null,
      statusCode: 500,
      userEmail: email || null,
      metadata: { organization: organization || null }
    });
    return NextResponse.json({ error: "Unable to create the organization and start the trial." }, { status: 500 });
  }
}
