import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createOrganizationAndAdmin, findUserByEmail } from "@/src/lib/server/db";
import { setSession } from "@/src/lib/server/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const organization = String(body.organization || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!organization || !name || !email || password.length < 8) return NextResponse.json({ error: "Complete all fields and use at least 8 password characters." }, { status: 400 });
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Registration requires DATABASE_URL. Demo login remains available." }, { status: 503 });
    if (await findUserByEmail(email)) return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await createOrganizationAndAdmin({ organization, name, email, passwordHash });
    await setSession({ userId: result.userId, orgId: result.orgId, role: "admin", email });
    return NextResponse.json({ ok: true, redirect: "/checkout" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to create the organization." }, { status: 500 });
  }
}
