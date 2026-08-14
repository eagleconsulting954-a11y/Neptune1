import { NextResponse } from "next/server";
import { acceptOrganizationInvitation } from "@/src/lib/server/org-access";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    if (!token || !name || password.length < 12) {
      return NextResponse.json({ error: "Invitation, name, and a password of at least 12 characters are required." }, { status: 400 });
    }
    await acceptOrganizationInvitation({ token, name, password });
    return NextResponse.json({ ok: true, redirect: "/login?verified=success" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "INVITATION_INVALID") return NextResponse.json({ error: "This invitation is invalid, expired, or already used." }, { status: 400 });
    if (message === "EMAIL_ALREADY_REGISTERED") return NextResponse.json({ error: "This email already has a Neptune account." }, { status: 409 });
    if (message === "PASSWORD_TOO_SHORT") return NextResponse.json({ error: "Use at least 12 password characters." }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Unable to accept this invitation." }, { status: 500 });
  }
}
