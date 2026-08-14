import { NextResponse } from "next/server";
import { consumeEmailVerification, recordAuditEvent, requestIp, resendEmailVerification } from "@/src/lib/server/security";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (token) {
      const user = await consumeEmailVerification(token);
      if (!user) return NextResponse.json({ error: "This verification link is invalid or expired." }, { status: 400 });
      await recordAuditEvent({
        session: { userId: user.id, orgId: user.org_id, email: user.email },
        action: "auth.email_verified",
        entityType: "user",
        entityId: user.id,
        route: "/api/auth/verify-email",
        method: "POST",
        request
      });
      return NextResponse.json({ ok: true, redirect: "/login?verified=success" });
    }

    if (!email || !email.includes("@")) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    await resendEmailVerification(email, appUrl, requestIp(request));
    return NextResponse.json({ ok: true, message: "If the account still needs verification, a new link has been sent." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "VERIFICATION_RATE_LIMITED") {
      return NextResponse.json({ error: "Too many verification requests. Try again later." }, { status: 429 });
    }
    if (message.startsWith("EMAIL_")) return NextResponse.json({ error: "Unable to deliver the verification email right now." }, { status: 503 });
    console.error(error);
    return NextResponse.json({ error: "Unable to verify this account." }, { status: 500 });
  }
}
