import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";

export async function POST() {
  try {
    await requireSession();
    const response = NextResponse.json({ ok: true });
    response.cookies.set("neptune_paid", "active", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
    return response;
  } catch {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }
}
