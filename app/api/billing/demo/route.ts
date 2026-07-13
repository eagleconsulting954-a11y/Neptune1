import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: "Demo access no longer unlocks the production dashboard. Use the public interactive demo at /demo or start a real 14-day trial."
  }, { status: 410 });
}
