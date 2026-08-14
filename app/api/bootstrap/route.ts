import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/server/auth";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import { ensureSchema } from "@/src/lib/server/db";

async function authorize() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (!isDesignatedAdminEmail(session.email)) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  return NextResponse.json(await ensureSchema());
}

export async function POST() {
  const denied = await authorize();
  if (denied) return denied;
  return NextResponse.json(await ensureSchema());
}
