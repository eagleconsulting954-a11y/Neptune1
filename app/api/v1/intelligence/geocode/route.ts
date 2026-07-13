import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { geocodeLocation } from "@/src/lib/server/maritime";

export async function GET(request: Request) {
  try {
    await requireSession();
    const query = new URL(request.url).searchParams.get("q")?.trim();
    if (!query || query.length < 2) return NextResponse.json({ error: "A location search of at least two characters is required." }, { status: 400 });
    return NextResponse.json({ results: await geocodeLocation(query) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Unable to resolve this maritime location.", detail: message }, { status: 502 });
  }
}
