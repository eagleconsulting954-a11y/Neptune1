import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createOrganizationAndAdmin, findUserByEmail } from "@/src/lib/server/db";
import { startTrial } from "@/src/lib/server/trial";
import { normalizePlan } from "@/src/lib/plans";
import { recordSystemError } from "@/src/lib/server/platform-admin";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import {
  consumeActionRateLimit,
  createEmailVerification,
  recordAuditEvent,
  requestIp,
  sendVerificationEmail
} from "@/src/lib/server/security";

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
    const ip = requestIp(request);

    if (!organization || !name || !email || password.length < 12) {
      return NextResponse.json({ error: "Complete all fields and use at least 12 password characters." }, { status: 400 });
    }
    if (isDesignatedAdminEmail(email)) {
      return NextResponse.json({ error: "This Neptune administrator identity is reserved and must be provisioned internally." }, { status: 403 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "Account registration is temporarily unavailable because the production database is not connected." }, { status: 503 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Verified account email delivery must be configured before new organizations can register." }, { status: 503 });
    }

    const ipAllowed = await consumeActionRateLimit("signup-ip", ip || "unknown", 8, 60, 60);
    const emailAllowed = await consumeActionRateLimit("signup-email", email, 3, 1440, 1440);
    if (!ipAllowed || !emailAllowed) {
      return NextResponse.json({ error: "Too many registration attempts. Try again later.", code: "SIGNUP_RATE_LIMITED" }, { status: 429 });
    }

    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await createOrganizationAndAdmin({ organization, name, email, passwordHash });
    const entitlement = await startTrial(result.orgId, selectedPlan);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const verification = await createEmailVerification(result.userId, appUrl);
    let deliveryError = false;

    try {
      await sendVerificationEmail({ to: email, name, verificationUrl: verification.verificationUrl });
    } catch (error) {
      deliveryError = true;
      await recordSystemError({
        source: "api",
        severity: "error",
        route: "/api/auth/signup",
        method: "POST",
        message: error instanceof Error ? error.message : "Verification email delivery failed",
        userEmail: email,
        metadata: { organization }
      });
    }

    await recordAuditEvent({
      session: { userId: result.userId, orgId: result.orgId, email },
      action: "auth.organization_registered",
      entityType: "organization",
      entityId: result.orgId,
      route: "/api/auth/signup",
      method: "POST",
      request,
      metadata: { plan: entitlement.plan, verificationDeliveryError: deliveryError }
    });

    return NextResponse.json({
      ok: true,
      redirect: `/verify-email?sent=1&email=${encodeURIComponent(email)}${deliveryError ? "&delivery=retry" : ""}`,
      verificationRequired: true,
      deliveryError,
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
