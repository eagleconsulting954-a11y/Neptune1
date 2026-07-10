import { NextResponse } from "next/server";
import { ensureSchema } from "@/src/lib/server/db";

export async function GET() {
  return NextResponse.json(await ensureSchema());
}

export async function POST() {
  return NextResponse.json(await ensureSchema());
}
