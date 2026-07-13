import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { clearSession } from "@/src/lib/server/auth";
import { consumePasswordResetToken } from "@/src/lib/server/password-reset";
import { recordSystemError } from "@/src/lib/server/platform-admin";

function passwordIsStrong(password: string) {
  return password.length >= 10
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!token) return NextResponse.json({ error: "This password reset link is missing its secure token." }, { status: 400 });
    if (password !== confirmPassword) return NextResponse.json({ error: "The passwords do not match." }, { status: 400 });
    if (!passwordIsStrong(password)) {
      return NextResponse.json({ error: "Use at least 10 characters with uppercase, lowercase, and a number." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await consumePasswordResetToken(token, passwordHash);
    if (!user) {
      return NextResponse.json({ error: "This reset link is invalid, expired, or has already been used." }, { status: 400 });
    }

    await clearSession();
    return NextResponse.json({ ok: true, redirect: "/login?reset=success" });
  } catch (error) {
    console.error(error);
    await recordSystemError({
      source: "api",
      severity: "critical",
      route: "/api/auth/reset-password",
      method: "POST",
      message: error instanceof Error ? error.message : "Unknown password reset completion failure",
      stack: error instanceof Error ? error.stack : null,
      statusCode: 500
    });
    return NextResponse.json({ error: "Unable to update the password right now." }, { status: 500 });
  }
}
