import { NextResponse } from "next/server";
import { createPasswordResetRequest, sendPasswordResetEmail } from "@/src/lib/server/password-reset";
import { recordSystemError } from "@/src/lib/server/platform-admin";

const GENERIC_MESSAGE = "If an account exists for that email, a secure reset link has been sent.";

export async function POST(request: Request) {
  let email = "";
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Password reset email delivery is not configured yet." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    email = String(body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const reset = await createPasswordResetRequest({ email, appUrl, requestIp: forwardedFor });

    if (reset && !reset.rateLimited && reset.resetUrl) {
      await sendPasswordResetEmail({
        to: reset.user.email,
        name: reset.user.name,
        resetUrl: reset.resetUrl
      });
    }

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error(error);
    await recordSystemError({
      source: "api",
      severity: "error",
      route: "/api/auth/forgot-password",
      method: "POST",
      message: error instanceof Error ? error.message : "Unknown password reset request failure",
      stack: error instanceof Error ? error.stack : null,
      statusCode: 500,
      userEmail: email || null
    });
    return NextResponse.json({ error: "Unable to send the reset email right now. Please try again shortly." }, { status: 500 });
  }
}
